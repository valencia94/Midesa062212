import webbrowser
import requests
from requests_oauthlib import OAuth2Session
import sys
import os
import json

authorization_base_url = 'https://api.projectplace.com/oauth2/authorize'
token_url = 'https://api.projectplace.com/oauth2/access_token'
api_endpoint = 'https://api.projectplace.com'
client_id = None
client_secret = None
redirect_uri = None
force_refresh_token = False
reauthenticate = False
token = None


def get_authorized_session(session):
    authorization_url, state = session.authorization_url(authorization_base_url)

    print('Opening web-browser to', authorization_url)
    webbrowser.open(authorization_url, new=1)
    oauth_code = input('Enter Code: ')

    access_token_response = requests.post(token_url, data={
        'client_id': client_id,
        'client_secret': client_secret,
        'code': oauth_code,
        'grant_type': 'authorization_code'
    })

    if access_token_response.status_code == 200:
        token = access_token_response.json()

        print('User successfully authorized, with token:', token)

        with open('access_token.json', 'w') as stored_access_token:
            stored_access_token.write(json.dumps(token))

        return OAuth2Session(client_id=client_id, token=token)

    else:
        print(access_token_response.text)


if __name__ == '__main__':
    if os.path.isfile('access_token.json'):
        with open('access_token.json', 'r') as stored_access_token:
            try:
                token = json.loads(stored_access_token.read())
            except ValueError:
                token = None

    client_id = sys.argv[1]
    client_secret = sys.argv[2]
    redirect_uri = sys.argv[3]
    force_refresh_token = True if '--force_refresh' in sys.argv else False
    reauthenticate = True if '--reauthenticate' in sys.argv else False

    if token and not reauthenticate:
        projectplace = OAuth2Session(client_id, token=token)
    else:
        projectplace = get_authorized_session(OAuth2Session(client_id, redirect_uri=redirect_uri))

    print('Calling with token', projectplace.token)
    response = projectplace.get(api_endpoint + '/1/user/me/profile')

    if response.status_code == 401 or force_refresh_token:
        print('Unauthorized, access token may have expired - attempting to refresh token.')

        refresh_response = requests.post(token_url, {
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': projectplace.token[u'refresh_token'],
            'grant_type': 'refresh_token'
        })

        if refresh_response.status_code == 200:
            token = refresh_response.json()
            with open('access_token.json', 'w') as stored_access_token:
                stored_access_token.write(json.dumps(token))
            projectplace = OAuth2Session(client_id=client_id, token=token)
            print('%s: Refreshing token worked, new access token:', token)
        else:
            print('%s: Refreshing failed, response =', refresh_response.text)

    if response.status_code == 200:
        print('200 OK Successfully fetched profile belonging to', response.json()['sort_name'])