import antfu from "@antfu/eslint-config";

export default antfu({
  stylistic: {
    semi: true,
    quotes: "double",
  },
  rules: {
    "no-console": "off",
    "node/prefer-global/buffer": "off",
    "node/prefer-global/process": "off",
    "test/no-import-node-test": "off",
  },
});
