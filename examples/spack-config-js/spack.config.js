console.log('foo!');

module.exports = {
    entry: {
        'web': __dirname + '/src/web.ts',
        'android': __dirname + '/src/android.ts',
    },
    output: {
        path: __dirname + '/lib'
    },
    module: {}
}