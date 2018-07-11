import uglify from "rollup-plugin-uglify";

export default {
    input: 'build/index.js',
    external: [
        "stream",
        "fs",
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