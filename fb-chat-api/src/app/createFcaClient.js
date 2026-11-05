"use strict";

const { DomainsManager } = require("../domains");
const { MessagesDomain } = require("../domains/messages");
const { ThreadsDomain } = require("../domains/threads");
const { UsersDomain } = require("../domains/users");
const { AccountDomain } = require("../domains/account");
const { RealtimeDomain } = require("../domains/realtime");
const { CapabilityResolver } = require("../utils/CapabilityResolver");
const { MqttRealtimeManager } = require("../utils/MqttRealtimeManager");

function compactNamespace(ns) {
    if (!ns || typeof ns !== "object") return ns;
    const out = {};
    for (const [k, v] of Object.entries(ns)) {
        if (typeof v === "function") out[k] = v;
    }
    return out;
}

function buildFallbackMessages(api) {
    return {
        send: api.sendMessage?.bind(api),
        edit: api.editMessage?.bind(api),
        unsend: api.unsendMessage?.bind(api),
        delete: api.deleteMessage?.bind(api),
        setReaction: api.setMessageReaction?.bind(api),
        sendTyping: api.sendTypingIndicator?.bind(api),
        markRead: api.markAsRead?.bind(api),
        markDelivered: api.markAsDelivered?.bind(api),
        markSeen: api.markAsSeen?.bind(api),
        markReadAll: api.markAsReadAll?.bind(api),
        upload: api.uploadAttachment?.bind(api),
        forward: api.forwardAttachment?.bind(api),
        forwardMessage: api.forwardMessage?.bind(api),
        shareContact: api.shareContact?.bind(api),
        changeColor: api.changeThreadColor?.bind(api),
        changeEmoji: api.changeThreadEmoji?.bind(api),
        getMessage: api.getMessage?.bind(api),
        getEmojiUrl: api.getEmojiUrl?.bind(api),
        resolvePhotoUrl: api.resolvePhotoUrl?.bind(api),
        getThreadColors: api.getThreadColors?.bind(api),
    };
}

function buildFallbackThreads(api) {
    return {
        getInfo: api.getThreadInfo?.bind(api),
        getList: api.getThreadList?.bind(api),
        getHistory: api.getThreadHistory?.bind(api),
        getPictures: api.getThreadPictures?.bind(api),
        getThemePictures: api.getThemePictures?.bind(api),
        search: api.searchForThread?.bind(api),
        createGroup: api.createNewGroup?.bind(api),
        addUser: api.addUserToGroup?.bind(api),
        removeUser: api.removeUserFromGroup?.bind(api),
        changeAdmin: api.changeAdminStatus?.bind(api),
        changeImage: api.changeGroupImage?.bind(api),
        changeNickname: (api.setNickname || api.nickname || api.changeNickname)?.bind(api),
        setTitle: api.setTitle?.bind(api),
        createPoll: api.createPoll?.bind(api),
        createThemeAI: api.createAITheme?.bind(api),
        delete: api.deleteThread?.bind(api),
        archive: api.changeArchivedStatus?.bind(api),
        mute: api.muteThread?.bind(api),
        handleRequest: api.handleMessageRequest?.bind(api),
    };
}

function buildFallbackUsers(api) {
    return {
        getInfo: api.getUserInfo?.bind(api),
        getInfoV2: api.getUserInfoV2?.bind(api),
        getID: api.getUserID?.bind(api),
        getFriendsList: api.getFriendsList?.bind(api),
    };
}

function buildFallbackAccount(api) {
    return {
        getCurrentUserID: api.getCurrentUserID?.bind(api),
        changeAvatar: api.changeAvatar?.bind(api),
        changeBio: api.changeBio?.bind(api),
        changeBlocked: api.changeBlockedStatus?.bind(api),
        handleFriendReq: api.handleFriendRequest?.bind(api),
        unfriend: api.unfriend?.bind(api),
        setPostReaction: api.setPostReaction?.bind(api),
        refreshDtsg: api.refreshFb_dtsg?.bind(api),
        logout: api.logout?.bind(api),
        addModule: api.addExternalModule?.bind(api),
        enableAutoSave: api.enableAutoSaveAppState?.bind(api),
    };
}

function buildFallbackRealtime(api) {
    return {
        listen: api.listenMqtt?.bind(api),
        stopListening: api.stopListening?.bind(api),
    };
}

function buildFallbackHttp(api) {
    return {
        get: api.httpGet?.bind(api),
        post: api.httpPost?.bind(api),
        postFormData: api.httpPostFormData?.bind(api),
    };
}

function buildFallbackScheduler(api) {
    return {
        schedule: api.scheduler?.schedule?.bind(api.scheduler),
    };
}

/**
 * Enhanced FCA Client with domain-based architecture
 * Maintains backward compatibility while offering improved organization
 */
function createFcaClient(api, options = {}) {
    const useEnhancedDomains = options.useEnhancedDomains !== false;

    if (useEnhancedDomains) {
        try {
            const domainsManager = new DomainsManager(api, options);
            
            // Initialize capability resolver
            const capabilities = new CapabilityResolver(options);
            
            // Initialize MQTT realtime manager
            const realtimeManager = new MqttRealtimeManager(options);

            return {
                raw: api,
                domains: domainsManager,
                capabilities,
                realtimeManager,
                
                // Backward compatible namespaces
                messages: domainsManager.messages,
                threads: domainsManager.threads,
                users: domainsManager.users,
                account: domainsManager.account,
                realtime: domainsManager.realtime,
                
                // Utility methods
                useMiddleware: domainsManager.useMiddleware.bind(domainsManager),
                useDomainMiddleware: domainsManager.useDomainMiddleware.bind(domainsManager),
                clearCache: domainsManager.clearAllCaches.bind(domainsManager),
                getStatus: domainsManager.getStatus.bind(domainsManager),
                getAvailableMethods: domainsManager.getAvailableMethods.bind(domainsManager),
                
                // Fallback for http and scheduler (keep simple)
                http: compactNamespace(buildFallbackHttp(api)),
                scheduler: compactNamespace(buildFallbackScheduler(api)),
            };
        } catch (error) {
            console.warn("Failed to create enhanced FCA client, falling back to legacy mode:", error.message);
            // Fall through to legacy implementation
        }
    }

    // Legacy fallback implementation
    const messages = compactNamespace(buildFallbackMessages(api));
    const threads = compactNamespace(buildFallbackThreads(api));
    const users = compactNamespace(buildFallbackUsers(api));
    const account = compactNamespace(buildFallbackAccount(api));
    const realtime = compactNamespace(buildFallbackRealtime(api));
    const http = compactNamespace(buildFallbackHttp(api));
    const scheduler = compactNamespace(buildFallbackScheduler(api));

    return {
        raw: api,
        messages,
        threads,
        users,
        account,
        realtime,
        http,
        scheduler,
    };
}

function attachClientFacade(api, options = {}) {
    const client = createFcaClient(api, options);
    api.client = client;
    
    // Attach namespaces to api for direct access
    if (!api.messages) api.messages = client.messages;
    if (!api.threads) api.threads = client.threads;
    if (!api.users) api.users = client.users;
    if (!api.account) api.account = client.account;
    if (!api.realtime) api.realtime = client.realtime;
    if (!api.http) api.http = client.http;
    if (!api.scheduler) api.scheduler = client.scheduler;
    
    // Attach domain manager if available
    if (client.domains) {
        api.domains = client.domains;
        api.capabilities = client.capabilities;
        api.realtimeManager = client.realtimeManager;
    }
    
    return client;
}

/**
 * Create message domain (legacy wrapper for compatibility)
 */
function createMessagesDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new MessagesDomain(api, "messages", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackMessages(api));
}

/**
 * Create thread domain (legacy wrapper for compatibility)
 */
function createThreadsDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new ThreadsDomain(api, "threads", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackThreads(api));
}

/**
 * Create user domain (legacy wrapper for compatibility)
 */
function createUsersDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new UsersDomain(api, "users", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackUsers(api));
}

/**
 * Create account domain (legacy wrapper for compatibility)
 */
function createAccountDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new AccountDomain(api, "account", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackAccount(api));
}

/**
 * Create realtime domain (legacy wrapper for compatibility)
 */
function createRealtimeDomain(api, options = {}) {
    if (options.useEnhancedDomains !== false) {
        try {
            return new RealtimeDomain(api, "realtime", options);
        } catch (error) {
            // Fall back to legacy
        }
    }
    return compactNamespace(buildFallbackRealtime(api));
}

function createHttpDomain(api) {
    return compactNamespace(buildFallbackHttp(api));
}

function createSchedulerDomain(api) {
    return compactNamespace(buildFallbackScheduler(api));
}

module.exports = {
    createFcaClient,
    attachClientFacade,
    createMessagesDomain,
    createThreadsDomain,
    createUsersDomain,
    createAccountDomain,
    createRealtimeDomain,
    createHttpDomain,
    createSchedulerDomain,
    
    // Export new utilities
    DomainsManager,
    MessagesDomain,
    ThreadsDomain,
    UsersDomain,
    AccountDomain,
    RealtimeDomain,
    CapabilityResolver,
    MqttRealtimeManager,
};
