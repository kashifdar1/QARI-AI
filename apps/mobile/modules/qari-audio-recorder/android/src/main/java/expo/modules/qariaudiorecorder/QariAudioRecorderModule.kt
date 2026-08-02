package expo.modules.qariaudiorecorder

import android.Manifest
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

// Target capture format per ADR-008/CLAUDE.md §3: 16kHz mono 16-bit PCM WAV.
// Captured directly via AudioRecord (raw PCM, no codec in the path) rather
// than MediaRecorder (which has no WAV/PCM AndroidOutputFormat and only
// ever produces AAC-in-m4a) — see ADR-008 for why this replaced the
// AAC-then-transcode plan in ADR-007.
private const val SAMPLE_RATE_HZ = 16_000
private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
private const val AUDIO_ENCODING = AudioFormat.ENCODING_PCM_16BIT
private const val CHANNEL_COUNT = 1
private const val BITS_PER_SAMPLE = 16
private const val WAV_HEADER_SIZE = 44

class QariAudioRecorderModule : Module() {
  private var audioRecord: AudioRecord? = null
  private var recordingThread: Thread? = null
  private val isThreadRunning = AtomicBoolean(false)
  private var outputFile: File? = null
  private var pcmBytesWritten: Long = 0

  override fun definition() = ModuleDefinition {
    Name("QariAudioRecorder")

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.RECORD_AUDIO)
    }

    AsyncFunction("getPermissionsAsync") { promise: Promise ->
      Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.RECORD_AUDIO)
    }

    AsyncFunction("startRecording") { promise: Promise ->
      try {
        promise.resolve(startRecordingInternal())
      } catch (e: Exception) {
        promise.reject("RECORDING_START_FAILED", e.message ?: "Failed to start recording", e)
      }
    }

    AsyncFunction("pauseRecording") { promise: Promise ->
      try {
        stopCaptureThreadAndRelease()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("RECORDING_PAUSE_FAILED", e.message ?: "Failed to pause recording", e)
      }
    }

    AsyncFunction("resumeRecording") { promise: Promise ->
      try {
        val file = outputFile ?: throw IllegalStateException("No recording to resume — call startRecording first")
        beginCapture(file, append = true)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("RECORDING_RESUME_FAILED", e.message ?: "Failed to resume recording", e)
      }
    }

    AsyncFunction("stopRecording") { promise: Promise ->
      try {
        promise.resolve(stopRecordingInternal())
      } catch (e: Exception) {
        promise.reject("RECORDING_STOP_FAILED", e.message ?: "Failed to stop recording", e)
      }
    }
  }

  private fun startRecordingInternal(): Map<String, Any?> {
    val context = appContext.reactContext ?: throw Exceptions.AppContextLost()
    val directory = File(context.cacheDir, "Audio").apply { if (!exists()) mkdirs() }
    val file = File(directory, "recording-${UUID.randomUUID()}.wav")
    file.outputStream().use { writeWavHeaderPlaceholder(it) }
    outputFile = file
    pcmBytesWritten = 0
    beginCapture(file, append = true)
    return mapOf("fileUri" to file.toURI().toString())
  }

  private fun beginCapture(file: File, append: Boolean) {
    val minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE_HZ, CHANNEL_CONFIG, AUDIO_ENCODING)
    if (minBufferSize <= 0) {
      throw IllegalStateException("AudioRecord.getMinBufferSize returned $minBufferSize — ${SAMPLE_RATE_HZ}Hz mono 16-bit PCM is not supported on this device")
    }
    val bufferSize = minBufferSize * 4
    val record = AudioRecord(
      MediaRecorder.AudioSource.MIC,
      SAMPLE_RATE_HZ,
      CHANNEL_CONFIG,
      AUDIO_ENCODING,
      bufferSize,
    )
    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      throw IllegalStateException("AudioRecord failed to initialize (state=${record.state})")
    }
    audioRecord = record
    record.startRecording()

    isThreadRunning.set(true)
    val thread = Thread {
      Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
      RandomAccessFile(file, "rw").use { raf ->
        raf.seek(file.length())
        val readBuffer = ByteArray(bufferSize)
        while (isThreadRunning.get()) {
          val bytesRead = record.read(readBuffer, 0, readBuffer.size)
          if (bytesRead > 0) {
            raf.write(readBuffer, 0, bytesRead)
            pcmBytesWritten += bytesRead
          }
        }
      }
    }
    recordingThread = thread
    thread.start()
  }

  /** Stops capture without discarding pcmBytesWritten/outputFile, so resumeRecording can append. */
  private fun stopCaptureThreadAndRelease() {
    isThreadRunning.set(false)
    recordingThread?.join()
    recordingThread = null
    audioRecord?.let {
      if (it.state == AudioRecord.STATE_INITIALIZED) it.stop()
      it.release()
    }
    audioRecord = null
  }

  private fun stopRecordingInternal(): Map<String, Any?> {
    stopCaptureThreadAndRelease()
    val file = outputFile ?: throw IllegalStateException("No active recording to stop")
    patchWavHeaderSizes(file, pcmBytesWritten)
    outputFile = null
    val bytesWritten = pcmBytesWritten
    pcmBytesWritten = 0
    return mapOf(
      "fileUri" to file.toURI().toString(),
      "size" to (WAV_HEADER_SIZE + bytesWritten),
    )
  }

  /** Writes a 44-byte RIFF/WAVE header with placeholder sizes (patched by
   * patchWavHeaderSizes once the real PCM byte count is known at stop). */
  private fun writeWavHeaderPlaceholder(out: java.io.OutputStream) {
    val byteRate = SAMPLE_RATE_HZ * CHANNEL_COUNT * BITS_PER_SAMPLE / 8
    val blockAlign = CHANNEL_COUNT * BITS_PER_SAMPLE / 8
    val header = java.nio.ByteBuffer.allocate(WAV_HEADER_SIZE).order(java.nio.ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray())
    header.putInt(0) // RIFF chunk size — patched on stop
    header.put("WAVE".toByteArray())
    header.put("fmt ".toByteArray())
    header.putInt(16) // fmt chunk size (PCM)
    header.putShort(1) // audio format = 1 (PCM)
    header.putShort(CHANNEL_COUNT.toShort())
    header.putInt(SAMPLE_RATE_HZ)
    header.putInt(byteRate)
    header.putShort(blockAlign.toShort())
    header.putShort(BITS_PER_SAMPLE.toShort())
    header.put("data".toByteArray())
    header.putInt(0) // data chunk size — patched on stop
    out.write(header.array())
  }

  private fun patchWavHeaderSizes(file: File, pcmBytes: Long) {
    RandomAccessFile(file, "rw").use { raf ->
      raf.seek(4)
      raf.write(intToLittleEndianBytes((WAV_HEADER_SIZE - 8 + pcmBytes).toInt()))
      raf.seek(40)
      raf.write(intToLittleEndianBytes(pcmBytes.toInt()))
    }
  }

  private fun intToLittleEndianBytes(value: Int): ByteArray =
    byteArrayOf(
      (value and 0xff).toByte(),
      ((value shr 8) and 0xff).toByte(),
      ((value shr 16) and 0xff).toByte(),
      ((value shr 24) and 0xff).toByte(),
    )
}
