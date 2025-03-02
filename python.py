"""
This script show cases the OAuth2 flow using Python 3

To test the script you must first have an application registered with Projectplace.

You also need to have the `requests` and `requests_oauthlib` libraries installed.

Invoke the script as such:

    $ python python.py CLIENT_ID APPLICATION_SECRET REDIRECT_URI

For example like this

    $ python python.py 0833dea4f3ffffff1e6295ac1b3d3e08 deded29dba64fffffa20aa4acae81166addda836 https://lvh.me/myredirect

The first thing that will happen is that a browser window will open, prompting you to authenticate the application.

Once you have done that, you will be redirected to the redirect URI and in the URI there will be a code attribute,
copy that attribute to the terminal as prompted.

Now you have an access token, and the script demos how you can call the profile API.

You can test how to refresh an access token by supplying the optional parameters `--refresh` and you can
go through the authentication flow again by supplying `--reauth`
"""
import pprint
import webbrowser
import requests
import argh
import json
import os
from requests_oauthlib import OAuth2Session

authorization_base_url = 'https://api.projectplace.com/oauth2/authorize'
token_url = 'https://api.projectplace.com/oauth2/access_token'
api_endpoint = 'https://api.projectplace.com'


def get_authorized_session(session, client_id, client_secret):
    authorization_url, state = session.authorization_url(authorization_base_url)

    print('Opening webrowser to', authorization_url)
    webbrowser.open(authorization_url, new=1)
    oauth_code = input('Enter Code: ')
    payload = {
        'client_id': client_id,
        'client_secret': client_secret,
        'code': oauth_code,
        'grant_type': 'authorization_code'
    }
    access_token_response = requests.post(token_url, data=payload)

    if access_token_response.status_code == 200:
        token = access_token_response.json()

        print('User successfully authorized, with token:', token)

        with open('access_token.json', 'w') as stored_access_token:
            stored_access_token.write(json.dumps(token))

        return OAuth2Session(client_id=client_id, token=token)

    else:
        print(access_token_response.text)


@argh.arg('--auth', help='Supply this flag in order to go through the entire flow from the start')
@argh.arg('--refresh', help='Supply this flag in order to refresh an already existing access token')
@argh.arg('redirect_uri', help='This is the redirect (callback) URL as defined in your application settings (this must match precisely)')
@argh.arg('client_secret', help='This is the secret of your application')
@argh.arg('client_id', help='This is the ID of your application')
def do_authorization_flow(
        client_id: str, client_secret: str, redirect_uri: str, refresh: bool = False,
        auth: bool = False
):
    token = None
    if os.path.isfile('access_token.json'):
        with open('access_token.json', 'r') as stored_access_token:
            try:
                token = json.loads(stored_access_token.read())
            except ValueError:
                pass

    if token and not auth:
        projectplace = OAuth2Session(client_id, token=token)
    else:
        projectplace = get_authorized_session(
            OAuth2Session(client_id, redirect_uri=redirect_uri), client_id, client_secret
        )

    print('Calling with token', projectplace.token)
    response = projectplace.get(api_endpoint + '/1/user/me/profile')

    if response.status_code == 401 or refresh:
        print('Attempting to refresh token.')

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
            print('Refreshing token worked, new access token:', token)
        else:
            print('Refreshing failed, response =', refresh_response.text)

    if response.status_code == 200:
        print('200 OK Successfully fetched profile belonging to', response.json()['sort_name'])


if __name__ == '__main__':
    argh.dispatch_command(do_authorization_flow)
