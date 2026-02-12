const Redis = require('ioredis');

const redis = new Redis({
    host: '::1',
    port: 6379,
    connectTimeout: 2000
});

redis.on('connect', () => {
    console.log('Successfully connected to Redis');
    redis.ping().then(res => {
        console.log('PING:', res);
        process.exit(0);
    }).catch(err => {
        console.error('PING failed:', err.message);
        process.exit(1);
    });
});

redis.on('error', (err) => {
    console.error('Connection failed:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('Timeout reached');
    process.exit(1);
}, 5000);
