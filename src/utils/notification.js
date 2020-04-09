let timer;
export const defaultNotificationSettings = {
  icon: window.location.origin + '/favicon.ico',
};

export function isSupported() {
  return 'Notification' in window;
}

export function isGranted() {
  return Notification.permission === 'granted';
}

function checkNotificationPermissionChange(callback) {
  clearTimeout(timer);
  timer = setTimeout(function () {
    if (Notification.permission !== 'default') {
      callback(Notification.permission);
      return;
    }
    checkNotificationPermissionChange(callback);
  }, 1000);
}

export function requestPermission() {
  return new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error('Notification Not supported'));
      return;
    }
    if (isGranted()) {
      resolve();
      return;
    }
    Notification.requestPermission()
      .then(function () {
        checkNotificationPermissionChange(function (permission) {
          if (permission === 'granted') {
            resolve();
            return;
          }
          reject(new Error('Notification permission not granted!'));
        });
      })
      .catch(reject);
  });
}

export function show(title, options = defaultNotificationSettings) {
  if (isSupported() && isGranted() && title) {
    new Notification(title, options);
  } else {
    options.onerror && options.onerror();
  }
}
