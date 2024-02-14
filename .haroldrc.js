// projects without ESM has to export configuration via `module.exports = {}`
export default {
  build: {
    env: { // environment variables that need to be passed to the bundler
      NO_HASH: true,
    },
    command: 'npm run build-production', // project build command
    path: 'public', // directory where the build files will take place
  },
  categories: { // file categories for comparison (RegExp)
    CSS: /\.css$/,
    JavaScript: /\.js$/,
    Images: /\.(png|jpe?g|gif|svg|webp|avif)$/,
    Fonts: /\.(woff|woff2|ttf|otf|eot)$/,
  },
};
