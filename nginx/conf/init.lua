local rds = require 'rds'
sql = {}
sql.safe = function(text)
	return ngx.quote_sql_str(text)
end
sql.query = function(db, query)
	local res = ngx.location.capture('/db/' .. db, { method = ngx.HTTP_POST, body = query })
	return res.status == 200 and rds(res.body) or res.body
end
sql.chat = function(query)
	return sql.query('webchat', query)
end
