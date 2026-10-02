// From https://dev.miraheze.org/wiki/Recent_changes_sidebar
mw.loader.using([ 'mediawiki.api', 'mediawiki.util' ], function () {
    const scriptPath = mw.config.get('wgScriptPath');
    const skin = mw.config.get('skin');

    function articleUrl(title) {
        return mw.util.getUrl(title);
    }

    function contributionsUrl(user) {
        return mw.util.getUrl('Special:Contributions/' + user);
    }

    function recentChangesUrl() {
        return mw.util.getUrl('Special:RecentChanges');
    }

    function message(key, fallback) {
        const msg = mw.message(key);

        return msg.exists() ? msg.text() : fallback;
    }

    function formatAge(timestamp) {
        const timeDelta = Date.now() - Date.parse(timestamp);
        let timeString = Math.round(timeDelta / 60000) + 'm';

        if (timeDelta >= 3600000) {
            timeString = Math.round(timeDelta / 3600000) + 'h';
        }
        if (timeDelta >= 86400000) {
            timeString = Math.round(timeDelta / 86400000) + 'd';
        }

        return timeString;
    }

    function recentChangeItem(entry) {
        const user = entry.user;
        const userText = entry.anon === '' ? message('anonymous', 'anonymous') : user;
        const $timeLink = $('<a>', {
            href: scriptPath + `?diff=${entry.revid}`
        }).append(
            document.createTextNode(formatAge(entry.timestamp) + ' '),
            $('<span>', {
                class: 'rc-sidebar-ago',
                text: 'ago'
            })
        );

        return $('<li>', {
            class: 'mw-list-item rc-sidebar-item'
        }).append(
            $('<a>', {
                class: 'rc-sidebar-page',
                href: articleUrl(entry.title),
                text: entry.title
            }),
            $('<p>', {
                class: 'rc-sidebar-user'
            }).append(
                $timeLink,
                document.createTextNode(' - '),
                $('<a>', {
                    href: contributionsUrl(user),
                    text: userText
                })
            )
        );
    }

    function citizenShowMoreItem(body) {
        const $showMore = $('<li>', {
            class: 'mw-list-item'
        }).append(
            $('<a>', {
                'data-mw': 'interface',
                href: recentChangesUrl(),
                rel: 'nofollow',
                title: 'A list of recent changes in the wiki'
            }).append(
                $('<span>', {
                    text: 'Show more...'
                })
            )
        );

        $(body).append(
            $('<ul>', {
                class: 'rc-sidebar-list'
            }).append($showMore)
        );

        return $showMore;
    }

    function populateRecentChanges($showMore, changes) {
        $showMore
            .children('a')
            .children('span')
            .last()
            .text('Show more...');

        $showMore.before(changes.map(function (entry) {
            return recentChangeItem(entry)[0];
        }));
    }

    // At this point the DOM might not be ready, so we don't know if we need
    // RC sidebar yet. We can still send an API request early since it's cached.
    const rcPromise = new mw.Api().get({
        action: 'query',
        list: 'recentchanges',
        rcprop: 'title|timestamp|user|ids',
        rcnamespace: '0',
        rclimit: '4',
        rctype: 'edit|new',
        rcshow: '!bot',
        rctoponly: '1',
        format: 'json',
        maxage: '120',
        smaxage: '120'
    });

    function showRecentChanges($showMore) {
        if (!$showMore.length) {
            return;
        }

        function handleError(msg) {
            console.error(msg);
        }

        rcPromise.done(function (data) {
            const changes = data.query && data.query.recentchanges ? data.query.recentchanges : [];

            if (changes.length === 0) {
                handleError("No recent change(s) found.");
                return;
            }

            populateRecentChanges($showMore, changes);
        }).fail(function (msg) {
            handleError(msg);
        });
    }

    if (skin === 'citizen') {
        mw.hook('citizen.pageAside.register').add(function (data) {
            const body = data.register({
                id: 'rcsidebar',
                label: message('recentchanges', 'Recent changes'),
                placement: 'flow',
                order: 15
            });

            if (body) {
                showRecentChanges(citizenShowMoreItem(body));
            }
        });
        return;
    }

    // Wait for DOM ready
    $(function () {
        showRecentChanges($('#p-Recent_changes #n-recentchanges').first());
    });
});
