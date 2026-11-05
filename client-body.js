/* 运行在 __ModuleLoader__ 工厂作用域内：React / h / comp 已就绪 */
const MindMap = comp.MindMap
const hh = h

/* KaTeX 由插件自己的 Host 路由喂进来（宿主模块表里没有它），脚本到位后置位 */
function useKatexReady() {
  const [ready, setReady] = React.useState(() => !!window.katex)
  React.useEffect(() => {
    if (ready) return undefined
    const on = () => setReady(!!window.katex)
    window.addEventListener('synapsis:katex', on)
    const timer = setTimeout(() => setReady(!!window.katex), 1500)
    return () => {
      window.removeEventListener('synapsis:katex', on)
      clearTimeout(timer)
    }
  }, [ready])
  return ready
}

async function jget(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  const text = await res.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {}
  if (!res.ok) throw new Error((parsed && parsed.error) || 'HTTP ' + res.status)
  return parsed
}

function Panel() {
  const [files, setFiles] = React.useState([])
  const [name, setName] = React.useState('')
  const [doc, setDoc] = React.useState(null)
  const [status, setStatus] = React.useState('读取图库…')
  const [error, setError] = React.useState('')
  const katexReady = useKatexReady()
  const renderMath = React.useMemo(
    () => (katexReady && window.katex ? comp.createMathRenderer(window.katex) : null),
    [katexReady],
  )
  const nameRef = React.useRef('')
  const timerRef = React.useRef(0)
  const docRef = React.useRef(null)

  nameRef.current = name
  docRef.current = doc

  const openNamed = React.useCallback(async (pick) => {
    setStatus('读取中…')
    setError('')
    try {
      const list = await jget('/synapsis-api/list')
      const items = (list && list.items) || []
      setFiles(items)
      const next = pick || nameRef.current || (items[0] && items[0].name) || ''
      if (next && items.some((item) => item.name === next)) {
        const loaded = await jget('/synapsis-api/load?name=' + encodeURIComponent(next))
        setName(next)
        setDoc(loaded)
      } else {
        setName('')
        setDoc(null)
      }
      setStatus('')
    } catch (err) {
      setError(err && err.message ? err.message : String(err))
      setStatus('')
    }
  }, [])

  React.useEffect(() => {
    openNamed('')
  }, [openNamed])

  React.useEffect(() => {
    const onFocus = () => {
      if (!docRef.current) return
      jget('/synapsis-api/list').then((list) => {
        if (list && list.items) setFiles(list.items)
      }).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const save = React.useCallback(async () => {
    const current = docRef.current
    const target = nameRef.current
    if (!current || !target) return
    try {
      await fetch('/synapsis-api/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: target, data: current }),
      })
      setStatus('已保存')
    } catch (err) {
      setStatus('保存失败：' + (err && err.message ? err.message : String(err)))
    }
  }, [])

  const onChange = React.useCallback(
    (next) => {
      setDoc(next)
      docRef.current = next
      setStatus('保存中…')
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(save, 600)
    },
    [save],
  )

  React.useEffect(() => () => clearTimeout(timerRef.current), [])

  if (error) {
    return hh(
      'div',
      { style: { padding: '28px 24px', font: 'inherit', lineHeight: 1.7 } },
      hh('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 6 } }, '读不到图库'),
      hh('div', { style: { opacity: 0.7, fontSize: 13 } }, error),
      hh(
        'button',
        { style: { marginTop: 12, font: 'inherit', fontSize: 13, padding: '6px 12px', cursor: 'pointer' }, onClick: () => openNamed('') },
        '重试',
      ),
    )
  }

  if (!doc) {
    return hh(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 10,
          fontSize: 13.5,
          opacity: 0.75,
        },
      },
      hh('div', { style: { fontSize: 22, letterSpacing: '0.2em' } }, '析域'),
      hh('div', null, status || '还没有图。用 Synapsis 网站把讲义生成出来，这里会自动出现。'),
      hh(
        'button',
        { style: { font: 'inherit', fontSize: 12.5, padding: '5px 12px', cursor: 'pointer' }, onClick: () => openNamed('') },
        '重新读取',
      ),
    )
  }

  const leading = hh(
    React.Fragment,
    null,
    hh(
      'select',
      {
        className: 'sn-libsel',
        value: name,
        onChange: (event) => openNamed(event.target.value),
        title: '切换图',
      },
      files.map((file) => hh('option', { key: file.name, value: file.name }, file.title)),
    ),
    hh(
      'button',
      {
        className: 'sn-iconbtn',
        title: '从磁盘重新读取',
        onClick: () => openNamed(name),
        style: { width: 22, height: 22, fontSize: 13 },
      },
      '↻',
    ),
  )

  return hh(MindMap, {
    data: doc,
    leading,
    renderMath,
    statusText: status,
    onChange,
  })
}
