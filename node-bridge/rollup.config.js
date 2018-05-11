import uglify from "rollup-plugin-uglify";

export default {
    input: 'build/index.js',
    external: [
        "stream",
        "fs",
        "fs/promises",
        "path"
    ],
    plugins: [
        uglify()
    ],

    treeshake: true,

    output: {
        file: 'dist/NodeBridge.js',
        format: 'cjs',
        exports: 'named'
    }
};