import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
// import * as serviceWorker from './serviceWorker';
import * as notification from './utils/notification';

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.unregister();

if (window.SW && window.SW.isSupported()) {
  notification.requestPermission().then(
    () => window.SW.register(),
    (err) => console.error(err)
  );
}
