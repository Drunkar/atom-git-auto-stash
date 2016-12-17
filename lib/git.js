'use babel';
const git = require('git-promise');
const q = require('q');


export default class Git {
    cwd = undefined;

    parseDefault(data) {
        return q.fcall(function() {
            return true;
        });
    }

    static callGit(cmd, parser, nodatalog) {
        console.log("> git " + cmd);
        if (atom.project) {
            repo = atom.project.getRepositories()[0];
            cwd = repo ? repo.getWorkingDirectory() : void 0;
        }

        return git(cmd, {
            cwd: cwd
        }).then(function(data) {
            if (!nodatalog) {
                console.log(data);
            }
            return parser(data);
        }).fail(function(e) {
            // atom.notifications.addWarning("git-auto-stash: " + e.stdout);
            // atom.notifications.addWarning("git-auto-stash: " + e.message);
            console.log(e.stdout);
            console.log(e.message);
        });
    }

    stash_store(comment) {
        this.stash_create()
            .then(function(hash) {
                // stash store
                return Git.callGit("stash store -m '" + comment + "' " + hash, function(data) {
                    repo.refreshStatus();
                    q.fcall(function() {
                        return true;
                    });
                });
            })
            .catch(function(reason) {
                atom.notifications.addWarning("git-auto-stash: " + reason);
                console.log(reason);
            });
    }

    stash_create() {
        return Git.callGit("stash create", function(data) {
            repo.refreshStatus();
            return q.fcall(function() {
                return data;
            });
        });
    }

    stash_list() {
        return Git.callGit("stash list", function(data) {
            repo.refreshStatus();
            return q.fcall(function() {
                return data.split('\n');
            });
        });
    }

    stash_drop(id) {
        Git.callGit("stash drop " + id, function(data) {
                repo.refreshStatus();
                return q.fcall(function() {
                    return data;
                });
            })
            .then(function() {
                return Promise.resolve();
            });
    }

}
