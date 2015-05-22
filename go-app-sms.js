// WARNING: This is a generated file.
//          If you edit it you will be sad.
//          Edit src/app.js instead.

var go = {};
go;

var Q = require('q');
var moment = require('moment');
var vumigo = require('vumigo_v02');
var JsonApi = vumigo.http.api.JsonApi;

// Shared utils lib
go.utils = {

    timed_out: function(im) {
        var no_redirects = ['state_language', 'state_migrant_main', 'state_refugee_main',
                            'state_locate_exit'];
        return im.msg.session_event === 'new'
            && im.user.state.name
            && no_redirects.indexOf(im.user.state.name) === -1;
    },

    eval_dialback_reminder: function(e, im, contact, $) {
        return go.utils.should_send_dialback_reminder(e, contact)
            ? go.utils.send_dialback_reminder(im, contact, $)
            : Q();
    },

    should_send_dialback_reminder: function(e, contact) {
        var dialback_states = [
            'state_language',
            'state_country',
            'state_status',
            'state_who_refugee',
            'state_who_migrant',
            'state_refugee_rights_info',
            'state_migrant_rights_info'
        ];
        return e.user_terminated
            && (contact.extra.dialback_reminder_sent !== 'true')
            && dialback_states.indexOf(e.im.state.name) !== -1;
    },

    send_dialback_reminder: function(im, contact, $) {
        return im.outbound
            .send_to_user({
                endpoint: 'sms',
                content: go.utils.get_dialback_reminder_sms(im, $)
            })
            .then(function() {
                contact.extra.dialback_reminder_sent = 'true';
                return im.contacts.save(contact);
            });
    },

    get_dialback_reminder_sms: function(im, $) {
        return $("Please dial back in to {{ USSD_number }} to complete the registration.")
            .context({
                USSD_number: im.config.channel
            });
    },

    save_language: function(im, contact, lang) {
        var lang_map = {
            en: 'english',
            fr: 'french',
            am: 'amharic',
            sw: 'swahili',
            so: 'somali'
        };
        contact.extra.lang = lang;
        contact.extra.language = lang_map[lang];

        return Q.all([
            im.user.set_lang(lang),
            im.contacts.save(contact)
        ]);
    },

    set_language: function(im, contact) {
        if (contact.extra.lang !== undefined) {
            return im.user.set_lang(contact.extra.lang);
        } else {
            return Q();
        }
    },

    update_language: function(im, contact, lang) {
        return go.utils
            .save_language(im, contact, lang)
            .then(function() {
                return Q.all([
                    go.utils.subscription_update_language(im, contact),
                    im.metrics.fire.inc(['total', 'change_language', 'last'].join('.')),
                    im.metrics.fire.sum(['total', 'change_language', 'sum'].join('.'), 1)
                ]);
            });
    },

    update_country: function(im, contact, country) {
        contact.extra.country = country;
        return Q.all([
            im.contacts.save(contact),
            im.metrics.fire.inc(['total', 'change_country', 'last'].join('.')),
            im.metrics.fire.sum(['total', 'change_country', 'sum'].join('.'), 1)
        ]);
    },

    update_status: function(im, contact, status) {
        contact.extra.status = status;
        return Q.all([
            im.contacts.save(contact),
            im.metrics.fire.inc(['total', 'change_status', 'last'].join('.')),
            im.metrics.fire.sum(['total', 'change_status', 'sum'].join('.'), 1)
        ]);
    },

    register_user: function(contact, im, status) {
        contact.extra.status = status;
        var country = contact.extra.country;

        return Q.all([
            im.contacts.save(contact),
            go.utils.subscription_subscribe(contact, im),
            im.metrics.fire.inc(['total', 'registrations', 'last'].join('.')),
            im.metrics.fire.sum(['total', 'registrations', 'sum'].join('.'), 1),
            im.metrics.fire.inc(['total', 'registrations', status, 'last'].join('.')),
            im.metrics.fire.sum(['total', 'registrations', status, 'sum'].join('.'), 1),
            im.metrics.fire.inc(['total', 'registrations', country, 'last'].join('.')),
            im.metrics.fire.sum(['total', 'registrations', country, 'sum'].join('.'), 1),
            im.metrics.fire.inc(['total', 'registrations', status, country, 'last'].join('.')),
            im.metrics.fire.sum(['total', 'registrations', status, country, 'sum'].join('.'), 1)
        ]);
    },

    track_redials: function(contact, im, decision) {
        var status = contact.extra.status || 'unregistered';
        return Q.all([
            im.metrics.fire.inc(['total', 'redials', 'choice_made', 'last'].join('.')),
            im.metrics.fire.sum(['total', 'redials', 'choice_made', 'sum'].join('.'), 1),
            im.metrics.fire.inc(['total', 'redials', status, 'last'].join('.')),
            im.metrics.fire.sum(['total', 'redials', status, 'sum'].join('.'), 1),
            im.metrics.fire.inc(['total', 'redials', decision, 'last'].join('.')),
            im.metrics.fire.sum(['total', 'redials', decision, 'sum'].join('.'), 1),
            im.metrics.fire.inc(['total', 'redials', status, decision, 'last'].join('.')),
            im.metrics.fire.sum(['total', 'redials', status, decision, 'sum'].join('.'), 1),
        ]);
    },

    get_clean_first_word: function(user_message) {
        return user_message
            .split(" ")[0]          // split off first word
            .replace(/\W/g, '')     // remove non letters
            .toUpperCase();         // capitalise
    },

    control_api_call: function (method, params, payload, endpoint, im) {
        var http = new JsonApi(im, {
            headers: {
                'Authorization': ['Token ' + im.config.api_key]
            }
        });
        switch (method) {
            case "post":
                return http.post(im.config.control.url + endpoint, {
                    data: payload
                });
            case "get":
                return http.get(im.config.control.url + endpoint, {
                    params: params
                });
            case "patch":
                return http.patch(im.config.control.url + endpoint, {
                    data: payload
                });
            case "put":
                return http.put(im.config.control.url + endpoint, {
                    params: params,
                  data: payload
                });
            case "delete":
                return http.delete(im.config.control.url + endpoint);
            }
    },

    subscription_subscribe: function(contact, im) {
        var payload = {
            contact_key: contact.key,
            to_addr: contact.msisdn,
            lang: contact.extra.lang,
            messageset_id: 1,
            schedule: 1
        };

        return go.utils
            .control_api_call("post", null, payload, 'subscription/', im)
            .then(function(result) {
                if (result.code >= 200 && result.code < 300){
                    return Q.all([
                        im.metrics.fire.inc(["total", "subscription_subscribe_success", "last"].join('.')),
                        im.metrics.fire.sum(["total", "subscription_subscribe_success", "sum"].join('.'), 1)
                    ]);
                } else {
                    return Q.all([
                        im.metrics.fire.inc(["total", "subscription_subscribe_fail", "last"].join('.')),
                        im.metrics.fire.inc(["total", "subscription_subscribe_fail", "sum"].join('.'), 1)
                    ]);
                }
        });
    },

    subscription_update_language: function(im, contact) {
        var params = {
            to_addr: contact.msisdn
        };
        return go.utils
        .control_api_call("get", params, null, 'subscription/', im)
        .then(function(json_result) {
            // change all subscription languages
            var update = json_result.data;
            var clean = true;  // clean tracks if api call is unnecessary
            for (i=0; i<update.objects.length; i++) {
                if (update.objects[i].lang !== contact.extra.lang) {
                    update.objects[i].lang = contact.extra.lang;
                    clean = false;
                }
            }
            if (!clean) {
                return go.utils
                .control_api_call("patch", {}, update, 'subscription/', im)
                .then(function(result) {
                    if (result.code >= 200 && result.code < 300) {
                        return Q.all([
                            im.metrics.fire.inc(["total", "subscription_lang_update_success", "last"].join('.')),
                            im.metrics.fire.sum(["total", "subscription_lang_update_success", "sum"].join('.'), 1)
                        ]);
                    } else {
                        return Q.all([
                            im.metrics.fire.inc(["total", "subscription_lang_update_fail", "last"].join('.')),
                            im.metrics.fire.sum(["total", "subscription_lang_update_fail", "sum"].join('.'), 1)
                        ]);
                    }
                });
            } else {
                return Q();
            }
        });
    },


    subscription_unsubscribe_all: function(contact, im) {
        var params = {
            to_addr: contact.msisdn
        };
        return go.utils
        .control_api_call("get", params, null, 'subscription/', im)
        .then(function(json_result) {
            // make all subscriptions inactive
            var update = json_result.data;
            var clean = true;  // clean tracks if api call is unnecessary
            for (i=0; i<update.objects.length; i++) {
                if (update.objects[i].active === true) {
                    update.objects[i].active = false;
                    clean = false;
                }
            }
            if (!clean) {
                return go.utils
                .control_api_call("patch", {}, update, 'subscription/', im)
                .then(function(result) {
                    if (result.code >= 200 && result.code < 300) {
                        return Q.all([
                            im.metrics.fire.inc(["total", "subscription_unsubscribe_success", "last"].join('.')),
                            im.metrics.fire.sum(["total", "subscription_unsubscribe_success", "sum"].join('.'), 1)
                        ]);
                    } else {
                        return Q.all([
                            im.metrics.fire.inc(["total", "subscription_unsubscribe_fail", "last"].join('.')),
                            im.metrics.fire.sum(["total", "subscription_unsubscribe_fail", "sum"].join('.'), 1)
                        ]);
                    }
                });
            } else {
                return Q();
            }
        });
    },

    opt_out: function(im, contact) {
        contact.extra.optout_last_attempt = go.utils.get_today(im.config);

        return Q.all([
            im.contacts.save(contact),
            go.utils.subscription_unsubscribe_all(contact, im),
            im.api_request('optout.optout', {
                address_type: "msisdn",
                address_value: contact.msisdn,
                message_id: im.msg.message_id
            })
        ]);
    },

    opt_in: function(im, contact) {
        contact.extra.optin_last_attempt = go.utils.get_today(im.config);
        return Q.all([
            im.contacts.save(contact),
            im.api_request('optout.cancel_optout', {
                address_type: "msisdn",
                address_value: contact.msisdn
            }),
        ]);
    },

    get_today: function(config) {
        var today;
        if (config.testing_today) {
            today = new moment(config.testing_today);
        } else {
            today = new moment();
        }
        return today.format('YYYY-MM-DD hh:mm:ss.SSS');
    },

    date_difference: function(date1, date2) {
        // returns the difference between the dates in days - true adds decimals
        return moment(date1).diff(moment(date2), 'days', true);
    },

    fire_returning_user_metrics: function(im, contact) {
        var today = go.utils.get_today(im.config);
        contact.extra.last_seen = today;
        var user_registered = contact.extra.status === 'refugee' || contact.extra.status === 'migrant';
        var no_last_returning_metric = contact.extra.last_returning_metric_fire === undefined;
        var old_last_returning_metric = go.utils.date_difference(today, contact.extra.last_returning_metric_fire) > 7;

        // For tracking weekly returning users. Only tracking returning registered users.  If the
        // user has never returned before or the user was last tracked more than a week ago, it
        // should fire a new metric and save the fact to the contact
        if (user_registered && (no_last_returning_metric || old_last_returning_metric)) {
            contact.extra.last_returning_metric_fire = today;
            return Q.all([
                im.metrics.fire.inc(["total", "returning_users", "last"].join('.')),
                im.metrics.fire.sum(["total", "returning_users", "sum"].join('.'), 1),
                im.contacts.save(contact)
            ]);
        } else {
            return im.contacts.save(contact);
        }
    },

    fire_main_menu_metrics: function(im, from_state, to_state) {
        return Q.all([
            im.metrics.fire.inc(["total", from_state, to_state, "last"].join('.')),
            im.metrics.fire.sum(["total", from_state, to_state, "sum"].join('.'), 1)
        ]);
    },

    locate_poi: function(im, contact) {
        var req_lookup_url = im.config.location_api_url + 'requestlookup/';
        var http = new JsonApi(im, {
            headers: {
                'Authorization': ['Token ' + im.config.api_key]
            }
        });
        return http.post(req_lookup_url, {
            data: go.utils.make_lookup_data(im, contact, go.utils.make_user_location_data(contact))
        })
        .then(function(response) {
            contact.extra.poi_url = response.data.url;
            return Q.all([
                im.contacts.save(contact),
                im.metrics.fire.inc(["total", "location_queries", "last"].join('.')),
                im.metrics.fire.inc(["total", "location_queries", "sum"].join('.'), 1)
            ]);
        });
    },

    make_user_location_data: function(contact) {
        var location_data = {
            point: {
                type: "Point",
                coordinates: [
                    parseFloat(contact.extra['location:lon']),
                    parseFloat(contact.extra['location:lat'])
                ]
            }
        };
        return location_data;
    },

    make_lookup_data: function(im, contact, user_location) {
        var lookup_data = {
            search: go.utils.make_poi_search_params(im),
            response: {
                type: "USSD",
                to_addr: contact.msisdn,
                template: im.config.template,  // used for SMS only
                results: "",
                results_detailed: '[]'
            },
            location: user_location
        };
        return lookup_data;
    },

    make_poi_search_params: function(im) {
        var poi_type_wanted = "all";  // hardcoded as no more info currently available
        var search_data = {};

        if (poi_type_wanted === "all") {
            im.config.poi_types.forEach(function(poi_type) {
                search_data[poi_type] = "true";
            });
        } else {
            search_data[poi_type_wanted] = "true";
        }
        return search_data;
    },

    get_poi_results: function(im, contact) {
        var http = new JsonApi(im, {
            headers: {
                'Authorization': ['Token ' + im.config.api_key]
            }
        });
        return http
            .get(contact.extra.poi_url)
            .then(function(response) {
                return JSON.parse(response.data.response.results_detailed);
            });
    },

    shorten_province: function(province) {
        var province_shortening = {
            'Gauteng': 'GP',
            'Mpumalanga': 'MP',
            'Limpopo': 'LP',
            'North West': 'NW',
            'Eastern Cape': 'EC',
            'Western Cape': 'WC',
            'Northern Cape': 'NC',
            'KwaZulu-Natal': 'KZN',
            'Free State': 'FS'
        };
        return province_shortening[province];
    },

    "commas": "commas"
};

go.app = function() {
    var vumigo = require('vumigo_v02');
    var MetricsHelper = require('go-jsbox-metrics-helper');
    var App = vumigo.App;
    var EndState = vumigo.states.EndState;


    var GoRR = App.extend(function(self) {
        App.call(self, 'state_start');
        var $ = self.$;

        self.init = function() {

            // Use the metrics helper to add some metrics
            mh = new MetricsHelper(self.im);
            mh
                // Total unique users
                .add.total_unique_users('total.sms.unique_users')

                // Total opt-outs
                .add.total_state_actions(
                    {
                        state: 'state_opt_out',
                        action: 'enter'
                    },
                    'total.optouts'
                )

                // Total opt-ins
                .add.total_state_actions(
                    {
                        state: 'state_opt_in',
                        action: 'enter'
                    },
                    'total.optins'
                )

                // Total opt-ins
                .add.total_state_actions(
                    {
                        state: 'state_unrecognised',
                        action: 'enter'
                    },
                    'total.unrecognised_sms'
                );

            // Load self.contact
            return self.im.contacts
                .for_user()
                .then(function(user_contact) {
                   self.contact = user_contact;
                });
        };


        self.states.add('state_start', function() {
            var user_first_word = go.utils.get_clean_first_word(self.im.msg.content);
            switch (user_first_word) {
                case "STOP":
                    return self.states.create("state_opt_out_enter");
                case "BLOCK":
                    return self.states.create("state_opt_out_enter");
                case "START":
                    return self.states.create("state_opt_in_enter");
                default:
                    return self.states.create("state_unrecognised");
            }
        });


    // OPTOUT STATES
        self.states.add('state_opt_out_enter', function(name) {
            return go.utils
                .opt_out(self.im, self.contact)
                .then(function() {
                    return self.states.create('state_opt_out');
                });
        });

        self.states.add('state_opt_out', function(name) {
            return new EndState(name, {
                text: $('Thank you. You will no longer receive messages from us. Reply START to opt back in.'),
                next: 'state_start'
            });
        });


    // OPTIN STATES
        self.states.add('state_opt_in_enter', function(name) {
            return go.utils
                .opt_in(self.im, self.contact)
                .then(function() {
                    return self.states.create('state_opt_in');
                });
        });

        self.states.add('state_opt_in', function(name) {
            return new EndState(name, {
                text: $('Thank you. You will now receive messages from us again. Reply STOP to unsubscribe.'),
                next: 'state_start'
            });
        });


    // UNRECOGNISED
        self.states.add('state_unrecognised', function(name) {
            return new EndState(name, {
                text: $('We do not recognise the message you sent us. Reply STOP to unsubscribe.'),
                next: 'state_start'
            });
        });

    });

    return {
        GoRR: GoRR
    };
}();

go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoRR = go.app.GoRR;

    return {
        im: new InteractionMachine(api, new GoRR())
    };
}();
