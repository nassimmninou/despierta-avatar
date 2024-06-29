import axios from 'axios';
import Cookie from 'universal-cookie';

export async function getTokenOrRefresh() {
    const cookie = new Cookie();
    const speechToken = cookie.get('speech-token');
    const expirationTime = cookie.get('speech-token-expiration');

    const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
    if (speechToken === undefined || currentTime >= expirationTime) {
        try {
            const url = `/api/ttsstt?type=stt`; // Append a timestamp to the URL
            const res = await axios.get(url);
            const token = res.data.token;
            const region = res.data.region;
            const newExpirationTime = currentTime + 540; // set new expiration time

            cookie.set('speech-token', region + ':' + token, {maxAge: 540, path: '/', sameSite: 'none', secure: true});
            cookie.set('speech-token-expiration', newExpirationTime, {maxAge: 540, path: '/', sameSite: 'none', secure: true});

            console.log('Token fetched from back-end: ' + token);
            return { authToken: token, region: region };
        } catch (err) {
            console.log(err.response.data);
            return { authToken: null, error: err.response.data };
        }
    } else {
        console.log('Token fetched from cookie: ' + speechToken);
        const idx = speechToken.indexOf(':');
        return { authToken: speechToken.slice(idx + 1), region: speechToken.slice(0, idx) };
    }
}
