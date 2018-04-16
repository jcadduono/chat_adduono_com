local concat = table.concat

module(...)

function explode(s, d, l)
	local p, a = 0, {}
	for k, v in function() return s:find(d, p, true) end do
		a[#a + 1] = s:sub(p, k - 1)
		p = v + 1
		if #a == l then break end
	end
	a[#a + 1] = s:sub(p)
	return a
end

function implode(s, d)
	return concat(s, d)
end

function trim(s)
	return s:match('^%s*(.*%S)') or ''
end