'use babel';

import GitAutoStashView from './git-auto-stash-view';
import Git from './git';
import { CompositeDisposable } from 'atom';

/*
TODO: last-auto-stashを下部に表示
*/

main = this;
const editor = atom.workspace.getActiveTextEditor();
editor.onDidStopChanging(function() {
  if(atom.project.getRepositories())
    main.default.autoStash();
});

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
  lastStashed: null,
  nowStashing: false,

  activate(state) {
    this.gitAutoStashView = new GitAutoStashView(state.gitAutoStashViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.gitAutoStashView.getElement(),
      visible: false
    });
    this.git = new Git();

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register commands
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

  getLastStashed() {
    return this.git.stash_list()
      .then(function(data) {

        // get auto stash list
        prefix = atom.config.get('git-auto-stash.stashCommentPrefix');
        auto_stashs = data.filter(function(item, index) {
          if (item.match(prefix)) return true;
        });
        if(auto_stashs.length == 0) return null;

        // extract time
        auto_stash_times = [];
        auto_stashs.forEach(function(auto_stash) {
          time = auto_stash.split(prefix)[1];
          if (time) {
            auto_stash_times.push(time);
          }
        });

        // desc sort
        auto_stash_times.sort(function(a, b) {
          if(a > b) return -1;
          if(a < b) return 1;
          return 0;
        });

        return auto_stash_times[0];
      });
  },

  /* Check the time and judge to stash or not. */
  autoStash() {
    if(this.nowStashing) return;

    if(!this.lastStashed) {
      this.getLastStashed()
        .then(function(latestStashed) {
          main.default.lastStashed = latestStashed;
          if(!latestStashed) main.default.stash();
          return true;
        });
    } else  {

      interval_minutes = atom.config.get('git-auto-stash.stashInterval');
      now = new Date().getTime();
      elapsed_minutes = (now - Date.parse(this.lastStashed)) / 1000 / 60;
      if(elapsed_minutes >= interval_minutes) this.stash();

    }
  },

  stash() {
    if(this.nowStashing) return;
    this.nowStashing = true;
    dropStashes = function(ids) {
      var stash_drop_promises = [];
      ids.forEach(function(id) {
        stash_drop_promises.push(main.default.git.stash_drop(id));
      });
      stash_drop_promises.push(Promise.reject("Drop finished."));
      return Promise.all(stash_drop_promises)
        .then(function (results) {
          console.log(results);
        });
    };

    // stash_time = main.default.getNowDateTime();
    stash_time = new Date().toString();
    /* Get a stash list */
    this.git.stash_list()

      /* Check the number of current auto stashes. */
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

      /*
        Called when auto_stashs.length >= upper_bound_stash.
        Drop old auto-stashes.
      */
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

      /* Save new stash */
      .catch(function (error) {
        console.log(error);
        return main.default.git.stash_store("auto stash at " + stash_time);
      });

    // update lastStashed
    this.lastStashed = stash_time;
    this.nowStashing = false;
  }

};
