// AdMob Mock + Capacitor bridge for POSSESS v0.1.0
window.AdMob = {
  _interstitialReady:false,
  _rewardedReady:false,
  init: function(){ console.log('[AdMob] init com.woojik01.possess'); this._interstitialReady=true; this._rewardedReady=true; },
  showInterstitial: function(){ console.log('[AdMob] Interstitial SHOW - 3 deaths'); },
  showRewarded: function(){ console.log('[AdMob] Rewarded SHOW - revive'); }
};
window.AdMob.init();
