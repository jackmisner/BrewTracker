// Jest runs through Babel/CJS, where `import.meta` is a syntax error.
// Vite handles import.meta natively, so these only apply in the test env.
const stripImportMetaHot = ({ types: t }) => ({
  name: "strip-import-meta-hot",
  visitor: {
    MemberExpression(path) {
      const { object, property, computed } = path.node;
      if (
        !computed &&
        t.isMetaProperty(object) &&
        object.meta.name === "import" &&
        object.property.name === "meta" &&
        t.isIdentifier(property, { name: "hot" })
      ) {
        path.replaceWith(t.identifier("undefined"));
      }
    },
  },
});

module.exports = {
  presets: [
    "@babel/preset-env",
    "@babel/preset-react",
    "@babel/preset-typescript",
  ],
  env: {
    test: {
      plugins: [
        // import.meta.env.X -> process.env.X
        "babel-plugin-transform-vite-meta-env",
        stripImportMetaHot,
      ],
    },
  },
};
