local gsub = ngx.re.gsub
local open = io.open
local type = type

module(...)

local function parseTags(str, tags)
	return (gsub(str, '\\[(\\w+)(?:\\/\\]|\\](.+?)\\[\\/\\1\\])', function(tag)
		local t = tags[tag[1]]
		if t ~= nil then
			if type(t) == 'function' then
				return #tag == 1 and t() or t(tag[2]) or ''
			end
			return t or ''
		else
			return #tag == 1 and '[' .. tag[1] .. '/]' or '[' .. tag[1] .. ']' .. tag[2] .. '[/' .. tag[1] .. ']'
		end
	end, 's'))
end

local function loadTemplate(fileName)
	local file = open(fileName, 'r')
	if file then
		return file:read('*all')
	end
end

function parse(str, tags, istr)
	if not istr then
		str = loadTemplate(str)
	end
	if str then
		if tags then
			return parseTags(str, tags)
		end
		return str
	end
	return istr and 'String is empty.' or 'File is empty or not found.'
end
