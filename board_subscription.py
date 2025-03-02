import json

import argh
import requests
import requests_oauthlib


APPLICATION_KEY = 'REDACTED'
APPLICATION_SECRET = 'REDACTED'
ACCESS_TOKEN_KEY = 'REDACTED'
ACCESS_TOKEN_SECRET = 'REDACTED'
API_ENDPOINT = 'https://api.projectplace.com'

oauth1 = requests_oauthlib.OAuth1(
    client_key=APPLICATION_KEY,
    client_secret=APPLICATION_SECRET,
    resource_owner_key=ACCESS_TOKEN_KEY,
    resource_owner_secret=ACCESS_TOKEN_SECRET
)


def _board_is_accessible(board_id):
    r = requests.get(
        f'{API_ENDPOINT}/1/boards/{board_id}', auth=oauth1
    )

    if r.status_code == 200:
        return r.json()['project_id']

    return None


def _subscribe_to_board(board_id, project_id, webhook_url):
    existing_webhooks = requests.get(
        f'{API_ENDPOINT}/1/webhooks/list',
        auth=oauth1
    ).json()

    for webhook in existing_webhooks:
        if webhook['artifact_type'] == 'board' and webhook['artifact_id'] == board_id and webhook['event_type'] == ['card_status_change']:
            if webhook_url != webhook['webhook']:
                # Webhook URL is different in existing subscription - lets update it
                requests.put(
                    f'{API_ENDPOINT}/1/webhooks/{webhook["id"]}/update',
                    json={
                        'event_type': ['card_status_change'],
                        'webhook': webhook_url
                    },
                    auth=oauth1
                )
            return webhook

    return requests.post(
        f'{API_ENDPOINT}/1/webhooks',
        json={
            'artifact_type': 'board',
            'artifact_id': board_id,
            'event_type': ['card_status_change'],
            'project_id': project_id,
            'webhook': webhook_url
        },
        auth=oauth1
    ).json()


def _unsubscribe_to_board(board_id):
    subscription_to_delete = None
    if active_board_subscriptions := _report_subscription_status(board_id):
        for sub in active_board_subscriptions:
            if sub['artifact_type'] == 'board' and sub['artifact_id'] == board_id and sub['event_type'] == ['card_status_change']:
                subscription_to_delete = sub
    if subscription_to_delete:
        requests.delete(
            f'{API_ENDPOINT}/1/webhooks/{subscription_to_delete["id"]}',
            auth=oauth1
        )


def _report_subscription_status(board_id):
    r = requests.get(
        f'{API_ENDPOINT}/1/webhooks/list',
        auth=oauth1
    )

    if r.status_code != 200:
        print(f'Failed to list subscriptions {r.content}')

    board_webhooks = []

    for webhook in r.json():
        if webhook['artifact_type'] == 'board' and webhook['artifact_id'] == board_id:
            board_webhooks.append(webhook)

    return board_webhooks


@argh.arg('board-id', help='The ID of a ProjectPlace board to which you have access', type=int)
@argh.arg('-w', '--webhook_url', default='', help='This should be the webhook which should get'
                                                  'invoked when the subscribed event happens')
@argh.arg('-u', '--unsubscribe', default=False, help='Delete the subscription if it exists')
def board_subscription(board_id, *, webhook_url='', unsubscribe=False):
    project_id = _board_is_accessible(board_id)
    if not project_id:
        print(f'Board does not exist or is not accessible using {oauth1.client}')
        exit(1)

    if webhook_url:
        _subscribe_to_board(board_id, project_id, webhook_url)
    elif unsubscribe:
        _unsubscribe_to_board(board_id)

    if active_board_subscriptions := _report_subscription_status(board_id):
        print(f'You have the following subscriptions for board {board_id}')
        print(json.dumps(active_board_subscriptions, indent=2, sort_keys=True))
    else:
        print(f'You have NO subscription for board {board_id}')


if __name__ == '__main__':
    argh.dispatch_command(board_subscription)
