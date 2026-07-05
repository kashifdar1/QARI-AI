import type { PracticeStackParamList } from './routeParams.js';

describe('route param typing', () => {
  it('requires passageId and sessionId for Recite', () => {
    const params: PracticeStackParamList['Recite'] = {
      passageId: 'passage-1',
      sessionId: 'session-1',
    };
    expect(params.passageId).toBe('passage-1');
  });
});
