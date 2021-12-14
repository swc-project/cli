const { config } = require('@swc/core/spack')


module.exports = config({
    entry: {
        'web': __dirname + '/src/web.ts',
        'android': __dirname + '/src/android.ts',
    },
    output: {
        path: __dirname + '/lib'
    },
    module: {},
});