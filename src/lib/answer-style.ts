// How the review answer is drawn (Settings → Reviews → Answer style):
//   pill:      a tinted pill that turns solid green or red.
//   underline: text on the page over a line in the type colour (hairline for a meaning, thick for
//              a reading) that turns green or red with the text.
//   wash:      no field; the whole screen takes the tint, then green or red.
//   ink:       no field and no colour but the typed words, which turn green or red.

import { localSetting } from './local-setting';

export type AnswerStyle = 'pill' | 'underline' | 'wash' | 'ink';

const setting = localSetting<AnswerStyle>('answer-style', ['pill', 'underline', 'wash', 'ink'], 'pill');

export const setAnswerStyle = setting.set;
export const useAnswerStyle = setting.use;
