/* service worker block */
(function () {
  if (self) {
    let timer;
    const watchFrequency = 1e4;
    let lastModifiedTime;
    let localLastUpdatedTime = 0;
    const apiPath = 'https://api.covid19india.org/data.json';
    let isWatcherRegistered = false;
    const defaultNotificationOptions = {
      icon: self.location.origin + '/favicon.ico',
    };

    function sendMessageToClient(data) {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage(data);
        });
      });
    }

    function fetchLastModifiedDate() {
      return new Promise((resolve, reject) => {
        fetch(apiPath + '?t=' + Math.random(), {method: 'HEAD'})
          .then((response) => {
            let serverLMT =
              response.headers.get('last-modified') ||
              response.headers.get('Last-Modified');
            if (serverLMT) {
              serverLMT = serverLMT.split(',')[1].replace('GMT', '').trim();
              resolve(new Date(serverLMT).getTime());
              return;
            }
            reject(new Error('No last modified time available'));
          })
          .catch((e) => {
            reject(e);
          });
      });
    }

    function fetchData() {
      return new Promise((resolve, reject) => {
        fetch(apiPath + '?t=' + Math.random())
          .then((response) => response.json())
          .then((data) => resolve(data))
          .catch((e) => {
            reject(e);
          });
      });
    }

    function isClientVisible() {
      return new Promise((resolve, reject) => {
        self.clients
          .matchAll({
            type: 'window',
            includeUncontrolled: true,
          })
          .then(function (windowClients) {
            let clientIsVisible = false;
            for (let i = 0; i < windowClients.length; i++) {
              const windowClient = windowClients[i];
              if (windowClient.visibilityState === 'visible') {
                clientIsVisible = true;
                break;
              }
            }
            resolve(clientIsVisible);
          })
          .catch(reject);
      });
    }

    function showNotification(title, options = {}) {
      if (self.registration) {
        const finalOptions = Object.assign(
          {},
          defaultNotificationOptions,
          options
        );
        self.registration.showNotification(title, finalOptions);
      }
    }

    function getLevelData(data) {
      let confirmed = 0;
      let active = 0;
      let recoveries = 0;
      let deaths = 0;
      let deltas = {};
      data.forEach((state, index) => {
        if (index !== 0) {
          confirmed += parseInt(state.confirmed);
          active += parseInt(state.active);
          recoveries += parseInt(state.recovered);
          deaths += parseInt(state.deaths);
        } else {
          deltas = {
            confirmed: parseInt(state.deltaconfirmed),
            deaths: parseInt(state.deltadeaths),
            recovered: parseInt(state.deltarecovered),
          };
        }
      });
      return {
        confirmed: confirmed,
        active: active,
        recoveries: recoveries,
        deaths: deaths,
        deltas: deltas,
      };
    }

    function getNotificationMessage(data) {
      const title = 'COVID-19 Update';
      let body = '';
      body += 'Confirmed: ' + data.confirmed + '\n';
      body += 'Active: ' + data.active + '\n';
      body += 'Recoveries: ' + data.recoveries + '\n';
      body += 'Deaths: ' + data.deaths + '\n';
      return {
        title: title,
        body: body,
      };
    }

    function notificationClicked(event) {
      const clickedNotification = event.notification;
      clickedNotification.close();
      const urlToOpen = new URL('/', self.location.origin).href;

      const promiseChain = clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then((windowClients) => {
          let matchingClient = null;

          for (let i = 0; i < windowClients.length; i++) {
            const windowClient = windowClients[i];
            if (windowClient.url === urlToOpen) {
              matchingClient = windowClient;
              break;
            }
          }

          if (matchingClient) {
            sendMessageToClient({
              type: 'refresh',
            });
            return matchingClient.focus();
          } else {
            return clients.openWindow(urlToOpen);
          }
        });

      event.waitUntil(promiseChain);
    }

    function handleNewResponse(response = {}) {
      const {statewise: data} = response;
      if (data) {
        const lastUpdatedTimeStamp = new Date(
          data[0].lastupdatedtime
        ).getTime();
        if (lastUpdatedTimeStamp > localLastUpdatedTime) {
          localLastUpdatedTime = lastUpdatedTimeStamp;
          const levelData = getLevelData(data);
          const messageObj = getNotificationMessage(levelData);
          showNotification(messageObj.title, {
            body: messageObj.body,
          });
        }
      }
    }

    function registerWatcher(event) {
      isWatcherRegistered = true;
      watchDataChange();
    }

    function watchDataChange() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        isClientVisible()
          .then((clientIsVisible) => {
            if (!clientIsVisible) {
              fetchLastModifiedDate()
                .then((value) => {
                  if (lastModifiedTime !== value) {
                    lastModifiedTime = value;
                    fetchData().then(handleNewResponse).catch(console.error);
                  }
                  watchDataChange();
                })
                .catch((e) => {
                  console.error(e);
                  watchDataChange();
                });
            } else {
              watchDataChange();
            }
          })
          .catch((e) => {
            console.error(e);
            watchDataChange();
          });
      }, watchFrequency);
    }
    self.addEventListener('activate', (event) => {
      !isWatcherRegistered && registerWatcher(event);
    });
    self.addEventListener('fetch', (event) => {
      !isWatcherRegistered && registerWatcher(event);
    });
    self.addEventListener('notificationclick', notificationClicked);
  }
})();

/* service worker registration block */

(function (MODULE) {
  function isLocalhost() {
    return Boolean(
      window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(
          /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
        )
    );
  }

  function isSupported() {
    if ('serviceWorker' in navigator) {
      return true;
    }
    return false;
  }

  function register(config) {
    if (isSupported()) {
      const swUrl = 'sw.js';
      if (isLocalhost()) {
        checkValidServiceWorker(swUrl, config);
      } else {
        registerValidSW(swUrl, config);
      }
    }
  }

  function swMessageHandler(event) {
    if (event && event.data) {
      if (event.data.type === 'refresh') {
        window.location.reload();
      }
    }
  }

  function registerValidSW(swUrl, config) {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        navigator.serviceWorker.ready.then(() => {
          navigator.serviceWorker.addEventListener('message', swMessageHandler);
        });
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) {
            return;
          }
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                if (config && config.onUpdate) {
                  config.onUpdate(registration);
                }
              } else {
                if (config && config.onSuccess) {
                  config.onSuccess(registration);
                }
              }
            }
          };
        };
      })
      .catch((error) => {
        config && config.onError && config.onError(error);
        console.error('Error during service worker registration:', error);
      });
  }

  function checkValidServiceWorker(swUrl, config) {
    fetch(swUrl, {
      headers: {'Service-Worker': 'script'},
    })
      .then((response) => {
        const contentType = response.headers.get('content-type');
        if (
          response.status === 404 ||
          (contentType != null && contentType.indexOf('javascript') === -1)
        ) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.unregister().then(() => {
              window.location.reload();
            });
          });
        } else {
          registerValidSW(swUrl, config);
        }
      })
      .catch(() => {
        console.log(
          'No internet connection found. App is running in offline mode.'
        );
      });
  }

  function unregister() {
    if (isSupported()) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.unregister();
        })
        .catch((error) => {
          console.error(error.message);
        });
    }
  }

  if (MODULE) {
    MODULE.SW = {
      register: register,
      isSupported: isSupported,
      unregister: unregister,
    };
  }
})(self);
