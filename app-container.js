// This script runs AFTER LiveCommitDashboard.jsx has loaded.

// Use the standard React DOM render method to inject the App component 
// into the div with the id 'root'.

ReactDOM.render(
    React.createElement(App, null, null),
    document.getElementById('root')
);

// Note: We use React.createElement instead of JSX here 
// because this file does not use the type="text/babel" attribute, 
// and plain JS is safer for the final render call.
