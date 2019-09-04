const progress = {
    json: {
        encode: function(command, data) {
            return JSON.stringify({
                command,
                data,
                time: Date.now()
            });
        },
        decode: function(str) {
            return JSON.parse(str);
        }
    }
};

module.exports = {
    get: function(key) {
        if (progress[key]) return progress[key];
        return progress.json;
    }
};
