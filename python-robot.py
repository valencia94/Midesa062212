"""
Working example of how to use a "robot" account.

A robot account is a hidden super user, which communicates over OAuth1 - as if that super
user had already authorized the application for access.

The code below demonstrates how to do a GET, POST and DELETE request using the
`requests` and `requests_oauthlib` libraries.

You will have to fill in the application and access token information based on your own
information.

More instructions printed as you run the script.

For more information on OAuth1 see: https://service.projectplace.com/apidocs/#articles/pageOAuth1.html
"""

import requests
import requests_oauthlib
import json
import os
import sys
import textwrap
import urllib.parse

APPLICATION_KEY = 'REDACTED'
APPLICATION_SECRET = 'REDACTED'
ACCESS_TOKEN_KEY = 'REDACTED'
ACCESS_TOKEN_SECRET = 'REDACTED'
API_ENDPOINT = 'https://api.projectplace.com'

oauth = requests_oauthlib.OAuth1(
    client_key=APPLICATION_KEY,
    client_secret=APPLICATION_SECRET,
    resource_owner_key=ACCESS_TOKEN_KEY,
    resource_owner_secret=ACCESS_TOKEN_SECRET
)


def _uri(path):
    """ Concatenates API_ENDPOINT and path """
    return urllib.parse.urljoin(API_ENDPOINT, path.lstrip('/'))


def _pretty_print_json(_obj):
    """ Indents and sorts any json compliant _obj and prints on stdout """
    print(json.dumps(_obj, indent=2, sort_keys=True))


def get_account_info():
    """
    Lets download some basic information about the enterprise account
    that the robot is a part of.
    """
    response = requests.get(_uri('/1/account'), auth=oauth)
    return response.json()


def create_project(project_name):
    """
    When creating the project - we first need to decide who should own it. So we pick a manager from the
    account info. (You could pick any account member, but for simplicity's sake we pick an account manager).
    """

    # The /1/account API returns a list of `managers` - lets pick the first one and take note of their user ID.
    owner_id = get_account_info()['managers'][0]['id']

    response = requests.post(
        _uri('/1/account/projects'),
        data={
            'name': project_name,
            'owner_id': owner_id
        },
        auth=oauth
    )

    print('Created Project:')
    _pretty_print_json(response.json())

    return response.json()


def delete_project(project_id):
    response = requests.delete(
        _uri(f'/1/projects/{project_id}'),
        auth=oauth
    )
    if response.status_code == 200:
        print(f'Deleted project {project_id}')
    else:
        print(f'Failed to delete {project_id} ')

    return response.status_code == 200


def print_account_info():
    """
    Lets pretty print some basic information about the enterprise account.
    """
    _pretty_print_json(get_account_info())


if __name__ == '__main__':
    if len(sys.argv) >= 2:
        if sys.argv[1] == 'account-info':
            print('View account info:')
            print_account_info()
        if sys.argv[1] == 'create-project':
            if len(sys.argv) < 3:
                print('Provide a project name also!')
                exit(1)
            project = create_project(sys.argv[2])
            delete_project(project['id'])
    else:
        print(textwrap.dedent(
            """
            Invoke the script such:
                
                `python python-robot.py account-info`
           
            or
                    
                `python python-robot.py create-project PROJECT_NAME`
                
            (where project name is the intended name of the project)
               
            Since the script is for demo purposes - the created project is immediately deleted.
            You can comment out the delete invokation if you wish to keep it around."""))
