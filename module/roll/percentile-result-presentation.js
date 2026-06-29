/**
 * @param {boolean} isSuccess
 * @param {boolean} isCritical
 * @returns {{ resultString: string, resultClass: string }}
 */
/* eslint-disable import/prefer-default-export */
export function getPercentileRollResultPresentation(isSuccess, isCritical) {
  let resultString = "";
  let resultClass = "";

  if (isSuccess) {
    if (isCritical) {
      resultString = game.i18n
        .localize("DG.Roll.CriticalSuccess")
        .toUpperCase();
      resultClass = "dg-roll-result--critical-success";
    } else {
      resultString = game.i18n.localize("DG.Roll.Success");
    }
  } else if (isCritical) {
    resultString = game.i18n.localize("DG.Roll.CriticalFailure").toUpperCase();
    resultClass = "dg-roll-result--critical-failure";
  } else {
    resultString = game.i18n.localize("DG.Roll.Failure");
  }

  return { resultString, resultClass };
}
