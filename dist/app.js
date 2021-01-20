(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

angular.module('app', []);
;
var HomeCtrl = function HomeCtrl($rootScope, $scope, $timeout) {
  _classCallCheck(this, HomeCtrl);

  $scope.formData = {
    loading: true,
    pushStatus: "Push Changes"
  };

  var componentRelay = new ComponentRelay({
    targetWindow: window,
    onReady: function onReady() {
      $scope.formData.loading = false;
      $scope.onReady();
    }
  });

  var defaultHeight = 60;

  componentRelay.streamContextItem(function (item) {
    $timeout(function () {
      $scope.note = item;
      if ($scope.repos) {
        $scope.loadRepoDataForCurrentNote();
      }
    });
  });

  $scope.onReady = function () {
    $scope.token = componentRelay.getComponentDataValueForKey("token");
    if ($scope.token) {
      $scope.onTokenSet();
    }
  };

  $scope.submitToken = function () {
    $scope.token = $scope.formData.token;
    componentRelay.setComponentDataValueForKey("token", $scope.token);
    $scope.onTokenSet();
  };

  $scope.onTokenSet = function () {
    $scope.gh = new GitHub({
      token: $scope.token
    });

    var me = $scope.gh.getUser();
    $scope.formData.loadingRepos = true;

    me.listRepos(function (err, repos) {
      $timeout(function () {
        $scope.formData.loadingRepos = false;
        if (err) {
          alert("An error occurred with the GitHub Push extension. Make sure your GitHub token is valid and try again.");
          return;
        }
        $scope.repos = repos;
        if ($scope.note) {
          $scope.loadRepoDataForCurrentNote();
        }
      });
    });
  };

  $scope.loadRepoDataForCurrentNote = function () {
    var noteData = componentRelay.getComponentDataValueForKey("notes") || {};
    var savedNote = noteData[$scope.note.uuid];

    if (savedNote) {
      // per note preference
      $scope.noteFileExtension = savedNote.fileExtension;
      $scope.noteFileDirectory = savedNote.fileDirectory;
      $scope.selectRepoWithName(savedNote.repoName);
    } else {
      // default pref
      var defaultRepo = componentRelay.getComponentDataValueForKey("defaultRepo");
      if (defaultRepo) {
        $scope.selectRepoWithName(defaultRepo);
      }
    }

    $scope.defaultFileExtension = componentRelay.getComponentDataValueForKey("defaultFileExtension");
    $scope.formData.fileExtension = $scope.noteFileExtension || $scope.defaultFileExtension || "txt";

    $scope.defaultFileDirectory = componentRelay.getComponentDataValueForKey("defaultFileDirectory");
    $scope.formData.fileDirectory = $scope.noteFileDirectory || $scope.defaultFileDirectory || "";
  };

  $scope.selectRepoWithName = function (name) {
    $scope.formData.selectedRepo = $scope.repos.filter(function (repo) {
      return repo.name === name;
    })[0];
    $scope.didSelectRepo();
  };

  $scope.didSelectRepo = function () {
    var repo = $scope.formData.selectedRepo;
    $scope.selectedRepoObject = $scope.gh.getRepo(repo.owner.login, repo.name);

    // save this as default repo for this note
    $scope.setDataForNote("repoName", repo.name);

    // save this as default repo globally
    if (!$scope.hasDefaultRepo) {
      componentRelay.setComponentDataValueForKey("defaultRepo", repo.name);
      $scope.hasDefaultRepo = true;
    }
  };

  $scope.setDataForNote = function (key, value) {
    var notesData = componentRelay.getComponentDataValueForKey("notes") || {};
    var noteData = notesData[$scope.note.uuid] || {};
    /**
     * Skip updating the component data if the current value and the new value for the key are the same.
     * This will prevent spamming the postMessage API with the same message, which causes high CPU usage.
     */
    if (noteData[key] === value) {
      return;
    }
    noteData[key] = value;
    notesData[$scope.note.uuid] = noteData;
    componentRelay.setComponentDataValueForKey("notes", notesData);
  };

  $scope.sanitizeFileDirectory = function ($directory) {
    // if no directory is given, then push to root.
    if (!$directory) {
      return '';
    }

    // try to ensure they haven't attempted any funny business with escape strings by turning
    // any backslashes into forward slashes - then replace any duplicate slashes with a single
    // slash.
    return $directory = $directory
    // make sure the last symbol is a '/'
    .replace(/[/]*$/g, '/')
    // make sure there are no escaping slashes.
    .replace(/\\/g, '/')
    // make sure there are no double '//'.
    .replace(/\/\//g, '/')
    // make sure the directory does not start with
    // a '/'.
    .replace(/^\/+/g, '');
  };

  $scope.pushChanges = function ($event) {
    $event.target.blur();
    var message = $scope.formData.commitMessage || 'Updated note \'' + $scope.note.content.title + '\'';

    var fileExtension = $scope.formData.fileExtension;
    var fileDirectory = $scope.formData.fileDirectory;

    if (!$scope.defaultFileExtension) {
      // set this as default
      componentRelay.setComponentDataValueForKey("defaultFileExtension", fileExtension);
      $scope.defaultFileExtension = fileExtension;
    }

    if (fileExtension !== $scope.noteFileExtension) {
      // set this ext for this note
      $scope.setDataForNote("fileExtension", fileExtension);
      $scope.noteFileExtension = fileExtension;
    }

    if (!$scope.defaultFileDirectory) {
      // set this as default
      componentRelay.setComponentDataValueForKey("defaultFileDirectory", fileDirectory);
      $scope.defaultFileDirectory = fileDirectory;
    }

    if (fileDirectory !== $scope.noteFileDirectory) {
      // set this directory for the note
      $scope.setDataForNote("fileDirectory", fileDirectory);
      $scope.noteFileDirectory = fileDirectory;
    }

    var fileName = $scope.sanitizeFileDirectory(fileDirectory) + $scope.note.content.title + "." + fileExtension;

    $scope.formData.pushStatus = "Pushing...";
    $scope.selectedRepoObject.writeFile("master", fileName, message, { encode: true }, function (err) {
      $timeout(function () {
        if (!err) {
          $scope.formData.commitMessage = "";
          $scope.formData.pushStatus = "Success!";
          $timeout(function () {
            $scope.formData.pushStatus = "Push Changes";
          }, 1500);
        } else {
          alert("Something went wrong trying to push your changes.", +err);
        }
      });
    });
  };

  $scope.logout = function () {
    componentRelay.clearComponentData();
    $scope.hasDefaultRepo = null;
    $scope.defaultFileExtension = null;
    $scope.defaultFileDirectory = null;
    $scope.noteFileExtension = null;
    $scope.noteFileDirectory = null;
    $scope.selectedRepo = null;
    $scope.repos = null;
    $scope.token = null;
  };

  componentRelay.setSize("100%", defaultHeight);
};

// required for FireFox


HomeCtrl.$$ngIsClass = true;

angular.module('app').controller('HomeCtrl', HomeCtrl);


},{}]},{},[1]);
