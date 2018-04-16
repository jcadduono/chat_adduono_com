module.exports = {
	listen_socket: '/home/nginx/upstream/webchat.sock',
	user: 'jc',
	group: 'jc',
	mysql: {
		socket: '/var/run/mysqld/mysqld.sock',
		user: 'webchat',
		password: '22222222',
		database: 'webchat',
		connection_pool_limit: 50
	},
	chat_roles: {
		server: 0,
		user: 1,
		host: 2,
		admin: 3,
		owner: 4
	},
	cookie_name: 'adduono_chat',
	room_message_cache_size: 10,
	room_max_message_length: 500,
	query_max_message_length: 500
}
