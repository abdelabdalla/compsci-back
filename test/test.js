var request = require("request"),
    assert = require("assert"),
    swype = require("../index.js");

var url = "http://localhost:3000/";
var i = "tester";
var e = "tester@tester.com";
var p = "testing";

var scriptID = 1;

var reg_account = {
    uri: url + "register",
    method: "POST",
    "Accept": "application/json",
    "Content-Type": "application/json",
    json: {
        id: i,
        pass: p,
        email: e
    }
};

var login_user = {
    uri: url + "login",
    method: "POST",
    "Accept": "application/json",
    "Content-Type": "application/json",
    json: {
        id: i,
        pass: p
    }
}

var create_script = {
    uri: url + "script/save",
    method: "POST",
    "Accept": "application/json",
    "Content-Type": "application/json",
    json: {
        name: "A script",
        creator: i,
        script: "FWD 7",
        print_count: 0
    }
}

var del_account = {
    uri: url + "user/remove",
    method: "DELETE",
    "Accept": "application/json",
    "Content-Type": "application/json",
    json: {
        id: i
    }
};

describe("Server test", function() {
    describe("GET /", function() {
        it("return 200", function(done) {
            request.get(url, function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
            });
        });

        it("return json", function(done) {
            request.get(url, function(error, response, body) {
                assert.notEqual("", body);
                done();
            });
        });

        it("save user", function(done) {
            request.post(reg_account, function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
            });
        });

        it("login user", function(done) {
            request.post(login_user, function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
            });
        });

        it("add script", function(done) {
            request.post(create_script, function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
            });
        });

        it("search scripts", function(done) {
            request.get(url + "script/search/" + i, function(error, response, body) {
                var obj = JSON.parse(body);
                scriptID = obj[0].id;
                assert.equal("A script", obj[0].name);
                done();
            });
        });

        it("add to queue", function(done) {
            request.put(url + "print/add/" + scriptID + "/" + i, function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
            });
        });

        it("remove from queue", function(done) {
            request.delete(url + "print/flush", function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
            });
        });

        it("remove script", function(done) {

            var del_script = {
                uri: url + "print/remove",
                method: "DELETE",
                "Accept": "application/json",
                "Content-Type": "application/json",
                json: {
                    id: scriptID
                }
            };

            request.delete(del_script, function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
            });
        });

        it("remove user", function(done) {
            request.delete(del_account, function(error, response, body) {
                assert.equal(200, response.statusCode);
                done();
                swype.closeServer();
            });
        });
    });
});
