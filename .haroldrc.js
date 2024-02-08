export default {
  build: {
    command: 'npm run build-production',
    path: 'public',
  },
  categories: {
    CSS: /\.css$/,
    JavaScript: /\.js$/,
    Images: /\.(png|jpe?g|gif|svg|webp|avif)$/,
    Fonts: /\.(woff|woff2|ttf|otf|eot)$/,
  },
};
