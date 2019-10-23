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
            try {
                return JSON.parse(str);
            } catch (error) {
                console.log(error, str);
                return {};
            }
        },
        encoding: 'utf8'
    }
};

module.exports = {
    get: function(key) {
        if (progress[key]) return progress[key];
        return progress.json;
    }
};
