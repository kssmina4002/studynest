(function () {
  let lastHash = null;

  async function checkForChanges() {
    try {
      const response = await fetch('reload-check.php', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Change check failed with HTTP ${response.status}`);
      }

      const result = await response.json();
      if (typeof result.hash !== 'string') {
        throw new Error(result.error || 'Change check returned an invalid response.');
      }

      if (lastHash !== null && result.hash !== lastHash) {
        window.location.reload();
        return;
      }
      lastHash = result.hash;
    } catch (error) {
      console.warn('StudyNest live reload:', error);
    } finally {
      window.setTimeout(checkForChanges, 2000);
    }
  }

  checkForChanges();
})();
