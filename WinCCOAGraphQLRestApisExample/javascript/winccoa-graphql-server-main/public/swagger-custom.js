// Custom Swagger UI initialization to detect correct server URL
// This runs in the browser and can correctly detect https:// from window.location

window.addEventListener('load', function() {
  console.log('[Swagger Custom] Page loaded, waiting for Swagger UI...');

  // Wait for Swagger UI to be initialized
  setTimeout(function() {
    console.log('[Swagger Custom] Checking for window.ui...');

    if (window.ui) {
      console.log('[Swagger Custom] window.ui found!');

      // Get the origin from the current page URL (will be https:// if loaded via HTTPS)
      const origin = window.location.origin;
      console.log('[Swagger Custom] Detected origin:', origin);

      // Only use the detected URL, remove localhost
      const servers = [{ url: origin, description: 'Current server' }];
      console.log('[Swagger Custom] Setting servers to:', servers);

      // Update the servers list using the correct Swagger UI API
      try {
        // Get the current spec
        const spec = window.ui.getSystem().specSelectors.specJson().toJS();
        console.log('[Swagger Custom] Current spec servers:', spec.servers);

        // Replace servers with only the detected URL
        spec.servers = servers;

        // Update the spec
        window.ui.getSystem().specActions.updateSpec(JSON.stringify(spec));
        console.log('[Swagger Custom] Spec updated! Only detected URL in list.');
      } catch (error) {
        console.error('[Swagger Custom] Error updating servers:', error);
      }
    } else {
      console.log('[Swagger Custom] window.ui not found yet');
    }
  }, 100);
});
