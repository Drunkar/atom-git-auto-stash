'use babel';

import GitAutoStashView from './git-auto-stash-view';
import Git from './git';
import { CompositeDisposable } from 'atom';

/*
repo = atom.project.getRepositories()[0];
git repositoryじゃないなら、repoがnullになる

TODO: 定期実行
TODO: last-auto-stashを下部に表示
*/

export default {

  config: {
    stashCommentPrefix: {
      description: 'Interval of auto stash save [minute].',
      type: 'string',
      default: 'auto stash at '
    },
    stashInterval: {
      description: 'Interval of auto stash save [minute].',
      type: 'integer',
      default: 10,
      minimum: 1,
      maximum: 60*24
    },
    maxNumOfAutoStash: {
      description: 'Maximum number of auto stash. When actual number exceeds this, it will be deleted from the oldest one.',
      type: 'integer',
      default: 10,
      minimum: 1
    }
  },

  gitAutoStashView: null,
  modalPanel: null,
  subscriptions: null,
  git: null,

  activate(state) {
    this.gitAutoStashView = new GitAutoStashView(state.gitAutoStashViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.gitAutoStashView.getElement(),
      visible: false
    });
    this.git = new Git();

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'git-auto-stash:auto stash': () => this.stash()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.gitAutoStashView.destroy();
  },

  getNowDateTime() {
    now = new Date();
    year = now.getFullYear();
    mon = now.getMonth()+1;
    day = now.getDate();
    hour = now.getHours();
    min = now.getMinutes();
    sec = now.getSeconds();
    return ( '0000' + year ).slice( -4 ) + "-" + ( '00' + mon ).slice( -2 ) + "-" + ( '00' + day ).slice( -2 ) + "_" + ( '00' + hour ).slice( -2 ) + ":" + ( '00' + min ).slice( -2 ) + ":" + ( '00' + sec ).slice( -2 );
  },

  serialize() {
    return {
      gitAutoStashViewState: this.gitAutoStashView.serialize()
    };
  },

  getAutoStashCount() {
    return this.git.stash_list();
  },

  stash() {
    main= this;
    dropStashes = function(ids) {
      var stash_drop_promises = [];
      ids.forEach(function(id) {
        stash_drop_promises.push(main.git.stash_drop(id));
      });
      stash_drop_promises.push(Promise.reject("Drop finished."));
      return Promise.all(stash_drop_promises)
        .then(function (results) {
          console.log(results);
        });
    };
    this.git.stash_list()
      .then(function(data) {
        prefix = atom.config.get('git-auto-stash.stashCommentPrefix');
        upper_bound_stash = atom.config.get('git-auto-stash.maxNumOfAutoStash');
        auto_stashs = data.filter(function(item, index) {
          if (item.match(prefix)) return true;
        });
        console.log("auto-stash num: " + auto_stashs.length);

        if (auto_stashs.length >= upper_bound_stash) {
          return auto_stashs;
        } else {
          return Promise.reject("auto stash num(" + auto_stashs.length + ") is within maxNumOfAutoStash(" + upper_bound_stash + ")");
        }
      })
      .then(function(data) {
        upper_bound_stash = atom.config.get('git-auto-stash.maxNumOfAutoStash');
        console.log("auto stash num(" + auto_stashs.length + ") will over maxNumOfAutoStash(" + upper_bound_stash + ")");

        // loop deleting oldest auto-stash
        // while auto_stashs.length >= upper_bound_stash
        // 1. get all stashs
        // 2. slice to ids which will be removed
        // 3. stash remove in descending order
        num_removed = auto_stashs.length - upper_bound_stash + 1;
        auto_stash_ids = [];
        auto_stashs.forEach(function(auto_stash) {
          id_strings = auto_stash.match(/stash@\{\d+\}/);
          if (id_strings) {
            auto_stash_ids.push(parseInt(id_strings[0].slice(7, -1)));
          }
        });

        // desc sort
        auto_stash_ids.sort(function(a, b) {
          if(a > b) return -1;
          if(a < b) return 1;
          return 0;
        });
        return dropStashes(auto_stash_ids.slice(0, num_removed));
      })
      .catch(function (error) {
        console.log(error);
        return main.git.auto_stash("auto stash at " + main.getNowDateTime());
      });
  }

};
