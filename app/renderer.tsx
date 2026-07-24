if (typeof __WEB_TARGET__ !== 'undefined' && __WEB_TARGET__) {
  void import('./renderer-web')
} else {
  void import('./renderer-desktop')
}

export {}
