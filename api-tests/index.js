import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    // duration: '20s', // Duration of the test
    stages: [
        { duration: '2m', target: 50 },   // ramp-up to 50 users (normal load)
        { duration: '3m', target: 100 },  // moderate traffic
        { duration: '2m', target: 200 },  // peak hours simulation
        { duration: '2m', target: 100 },  // taper off
        { duration: '1m', target: 0 },    // cool down
    ]
};

// export default function () {
//     let res = http.get('http://localhost:3000/api');
//     check(res, { 'status is 200': (r) => r.status === 200 });
//     sleep(1);
// }

export default function () {
    const url = 'http://localhost:3000/api/votes'; // Replace with your API endpoint
    const payload = JSON.stringify({
        userId: 'user-2',
        electionId: 'election123',
        candidateId: 'candidateA',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(url, payload, params);

    check(res, {
        'is status 200': (r) => r.status === 200
    });

    sleep(1); // Sleep for a second between requests
}