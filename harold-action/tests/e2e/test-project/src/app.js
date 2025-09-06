/**
 * Main application file for Harold Action E2E test
 */

console.log('Harold Action E2E Test Application');

// Simulate some application logic
const app = {
  name: 'Harold Action Test App',
  version: '1.0.0',

  init() {
    console.log(`Initializing ${this.name} v${this.version}`);
    this.setupEventListeners();
    this.loadModules();
  },

  setupEventListeners() {
    // Simulate event listener setup
    console.log('Setting up event listeners...');
  },

  loadModules() {
    // Simulate module loading
    console.log('Loading application modules...');

    // This would normally import other modules
    // For testing purposes, we'll just simulate it
    const modules = ['utils', 'components', 'services'];
    modules.forEach(module => {
      console.log(`Loading ${module} module...`);
    });
  },

  // Method that might be added in a feature branch
  newFeature() {
    console.log('This is a new feature that increases bundle size');

    // Simulate some additional code that would increase bundle size
    const largeData = new Array(1000).fill('data');
    return largeData.map(item => `processed-${item}`);
  }
};

// Initialize the app
app.init();

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
}
