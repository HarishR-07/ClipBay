import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Upload, Film, LogOut, CheckCircle2, Sparkles, Music, Wand2, Image as ImageIcon, Download, RotateCcw, Clock } from 'lucide-react'
import History from './History'
import { extractFrames, getFrameAt } from '../extractFrames'
import { renderVideoWithOverlays } from '../videoRenderer'
import { getBeatAlignedStart } from '../beatMatch'
export default function UploadVideo({ session }) {
  const [view, setView] = useState('editor') // 'editor' | 'history'
  const [referenceFile, setReferenceFile] = useState(null)
  const [referenceStyle, setReferenceStyle] = useState(null)
  const [analyzingReference, setAnalyzingReference] = useState(false)
  const [referenceStep, setReferenceStep] = useState(true)

  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [uploadedPath, setUploadedPath] = useState(null)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
 const [mood, setMood] = useState(null)
  const [script, setScript] = useState('')
  const [editingScript, setEditingScript] = useState(false)
  const [refiningScript, setRefiningScript] = useState(false)

  const refineScript = async (instruction) => {
    setRefiningScript(true)
    setError('')
    try {
      const res = await fetch('/api/refine-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, instruction, mood }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setScript(result.script)
    } catch (err) {
      setError('Script refinement failed: ' + err.message)
    }
    setRefiningScript(false)
  }

  const [generatingVoice, setGeneratingVoice] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [openaiVoice, setOpenaiVoice] = useState('alloy')
  const [elevenlabsVoice, setElevenlabsVoice] = useState('21m00Tcm4TlvDq8ikWAM')
  const [loadingMusic, setLoadingMusic] = useState(false)
  const [musicOffsets, setMusicOffsets] = useState({})

  const handleAudioLoaded = async (audioUrl, e) => {
    if (!audioUrl) return
    if (musicOffsets[audioUrl] !== undefined) {
      e.target.currentTime = musicOffsets[audioUrl]
      return
    }
    const offset = await getBeatAlignedStart(audioUrl)
    setMusicOffsets((prev) => ({ ...prev, [audioUrl]: offset }))
    e.target.currentTime = offset
  }
  const [musicTracks, setMusicTracks] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [ownMusicFile, setOwnMusicFile] = useState(null)
  const [showOwnMusicUpload, setShowOwnMusicUpload] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderedVideoUrl, setRenderedVideoUrl] = useState(null)
  const [captions, setCaptions] = useState([])
  const [captionPosition, setCaptionPosition] = useState('bottom')
  const [captionFont, setCaptionFont] = useState('auto')

  const fontUrlMap = {
    poppins: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf',
    anton: 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf',
    caveat: 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat-Bold.ttf',
    merriweather: 'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Bold.ttf',
  }

  const guessFontFromStyle = (styleText) => {
    const t = (styleText || '').toLowerCase()
    if (t.includes('handwrit')) return 'caveat'
    if (t.includes('serif') && !t.includes('sans')) return 'merriweather'
    if (t.includes('bold') || t.includes('impact') || t.includes('heavy')) return 'anton'
    return 'poppins'
  }

  const resolvedFontKey = captionFont === 'auto' ? guessFontFromStyle(referenceStyle?.fontStyle) : captionFont
  const captionFontUrl = fontUrlMap[resolvedFontKey]
  const [savingToHistory, setSavingToHistory] = useState(false)
  const [savedProject, setSavedProject] = useState(null) // { id, videoPath }
  const [historyError, setHistoryError] = useState('')

  const saveToHistory = async (videoUrl) => {
    setSavingToHistory(true)
    setHistoryError('')
    try {
      const blob = await (await fetch(videoUrl)).blob()
      const videoPath = `${session.user.id}/renders/${Date.now()}.mp4`

      const { error: uploadErr } = await supabase.storage
        .from('videos')
        .upload(videoPath, blob, { contentType: 'video/mp4' })
      if (uploadErr) throw uploadErr

      const { data, error: insertErr } = await supabase
        .from('projects')
        .insert({ user_id: session.user.id, video_path: videoPath, mood, script })
        .select()
        .single()
      if (insertErr) throw insertErr

      setSavedProject({ id: data.id, videoPath })
    } catch (err) {
      setHistoryError('Could not save to history: ' + err.message)
    }
    setSavingToHistory(false)
  }

  const undoSaveToHistory = async () => {
    if (!savedProject) return
    setSavingToHistory(true)
    try {
      await supabase.storage.from('videos').remove([savedProject.videoPath])
      await supabase.from('projects').delete().eq('id', savedProject.id)
      setSavedProject(null)
    } catch (err) {
      setHistoryError('Could not undo: ' + err.message)
    }
    setSavingToHistory(false)
  }

  const handleRender = async () => {
    setRendering(true)
    setRenderProgress(0)
    setError('')
    setSavedProject(null)
    try {
      const url = await renderVideoWithOverlays(file, parsedCommands, { voiceoverUrl: audioUrl, musicUrl: selectedTrack?.audioUrl }, referenceStyle?.colorValues, videoDuration, captions, captionPosition, captionFontUrl, setRenderProgress)
      setRenderedVideoUrl(url)
      saveToHistory(url)
      await supabase.from('drafts').delete().eq('user_id', session.user.id)
    } catch (err) {
      setError('Rendering failed: ' + err.message)
    }
    setRendering(false)
  }
  const [commandText, setCommandText] = useState('')
  const [parsingCommand, setParsingCommand] = useState(false)
  const [parsedCommands, setParsedCommands] = useState([])
  const [videoDuration, setVideoDuration] = useState(0)
  const [resumeDraft, setResumeDraft] = useState(null)

  useEffect(() => {
    supabase.from('drafts').select('data').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.data) setResumeDraft(data.data)
      })
  }, [])

  useEffect(() => {
    if (!uploadedPath) return
    const timeout = setTimeout(() => {
      supabase.from('drafts').upsert({
        user_id: session.user.id,
        data: {
          uploadedPath,
          mood,
          script,
          selectedTrack: selectedTrack?.own ? null : selectedTrack,
          parsedCommands: parsedCommands.map((c) => ({ ...c, overlayImage: null, previewFrameUrl: null })),
          captionPosition,
          captionFont,
        },
        updated_at: new Date().toISOString(),
      }).then(() => {})
    }, 1500)
    return () => clearTimeout(timeout)
  }, [uploadedPath, mood, script, selectedTrack, parsedCommands, captionPosition, captionFont])

  const applyResumeDraft = async () => {
    if (!resumeDraft) return
    setMood(resumeDraft.mood || null)
    setScript(resumeDraft.script || '')
    setSelectedTrack(resumeDraft.selectedTrack || null)
    setCaptionPosition(resumeDraft.captionPosition || 'bottom')
    setCaptionFont(resumeDraft.captionFont || 'auto')
    const restoredCommands = resumeDraft.parsedCommands || []
    if (resumeDraft.uploadedPath) {
      const { data, error } = await supabase.storage.from('videos').download(resumeDraft.uploadedPath)
      if (!error && data) {
        const restoredFile = new File([data], 'resumed-video.mp4', { type: data.type })
        setFile(restoredFile)
        setUploadedPath(resumeDraft.uploadedPath)
        const duration = await getVideoDuration(restoredFile)
        setVideoDuration(duration)
        const commandsWithPreviews = await Promise.all(
          restoredCommands.map(async (cmd) => {
            if (cmd.overlayImageUrl) {
              try {
                const previewFrameUrl = await getFrameAt(restoredFile, cmd.timestampSeconds)
                return { ...cmd, previewFrameUrl }
              } catch {
                return cmd
              }
            }
            return cmd
          })
        )
        setParsedCommands(commandsWithPreviews)
      }
    }
    if (!resumeDraft.uploadedPath) setParsedCommands(restoredCommands)
    setReferenceStep(false)
    setResumeDraft(null)
  }

  const discardDraft = async () => {
    await supabase.from('drafts').delete().eq('user_id', session.user.id)
    setResumeDraft(null)
  }
  const handleReferenceSelect = (e) => {
    const selected = e.target.files[0]
    if (selected) setReferenceFile(selected)
  }

  const analyzeReference = async () => {
    if (!referenceFile) return
    setAnalyzingReference(true)
    setError('')
    try {
      const frames = await extractFrames(referenceFile)
      const res = await fetch('/api/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, targetDuration: videoDuration }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setReferenceStyle(result)
      setReferenceStep(false)
    } catch (err) {
      setError('Reference analysis failed: ' + err.message)
    }
    setAnalyzingReference(false)
  }

  const skipReference = () => {
    setReferenceStyle(null)
    setReferenceStep(false)
  }

  const getVideoDuration = (selectedFile) => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.src = URL.createObjectURL(selectedFile)
      video.onloadedmetadata = () => resolve(video.duration)
    })
  }

  const handleFileSelect = async (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setUploadedPath(null)
      setError('')
      setMood(null)
      setScript('')
      setAudioUrl(null)
      setMusicTracks([])
      setSelectedTrack(null)
      setParsedCommands([])
      const duration = await getVideoDuration(selected)
      setVideoDuration(duration)
    }
  }

  const analyzeVideo = async (selectedFile) => {
    setAnalyzing(true)
    setError('')
    try {
      const frames = await extractFrames(selectedFile)
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setMood(result.mood)
      setScript(result.script)
      suggestMusic(result.mood)
    } catch (err) {
      setError('Analysis failed: ' + err.message)
    }
    setAnalyzing(false)
  }

  const suggestMusic = async (moodValue) => {
    setLoadingMusic(true)
    setMusicTracks([])
    try {
      const searchMood = referenceStyle?.musicMood || moodValue
      const res = await fetch('/api/suggest-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: searchMood, videoDuration }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setMusicTracks(result.tracks || [])
    } catch (err) {
      setError('Music suggestion failed: ' + err.message)
    }
    setLoadingMusic(false)
  }

  const handleOwnMusicSelect = async (e) => {
    const selected = e.target.files[0]
    if (!selected) return
    setOwnMusicFile(selected)

    const path = `${session.user.id}/${Date.now()}_${selected.name}`
    const { error: uploadError } = await supabase.storage.from('assets').upload(path, selected)
    const audioUrl = uploadError
      ? URL.createObjectURL(selected)
      : supabase.storage.from('assets').getPublicUrl(path).data.publicUrl

    setSelectedTrack({ name: selected.name, own: true, audioUrl })
  }

  const generateVoice = async (provider) => {
    setGeneratingVoice(true)
    setError('')
    setAudioUrl(null)
    try {
      const res = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          provider,
          voice: provider === 'openai' ? openaiVoice : elevenlabsVoice,
        }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      const audioSrc = `data:${result.mimeType};base64,${result.audio}`
      setAudioUrl(audioSrc)
      setCaptions(result.captions || [])
    } catch (err) {
      setError('Voice generation failed: ' + err.message)
    }
    setGeneratingVoice(false)
  }

  const submitCommand = async () => {
    if (!commandText.trim()) return
    setParsingCommand(true)
    setError('')
    try {
      const res = await fetch('/api/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandText, videoDuration }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setParsedCommands((prev) => [...prev, { ...result, rawText: commandText, overlayImage: null, overlayImageUrl: null }])
      setCommandText('')
    } catch (err) {
      setError('Command parsing failed: ' + err.message)
    }
    setParsingCommand(false)
  }

  const attachImageToCommand = async (index, e) => {
    const selected = e.target.files[0]
    if (!selected) return

    const path = `${session.user.id}/${Date.now()}_${selected.name}`
    const { error: uploadError } = await supabase.storage.from('assets').upload(path, selected)
    const overlayImageUrl = uploadError
      ? URL.createObjectURL(selected)
      : supabase.storage.from('assets').getPublicUrl(path).data.publicUrl

    let previewFrameUrl = null
    try {
      previewFrameUrl = await getFrameAt(file, parsedCommands[index].timestampSeconds)
    } catch (err) {
      console.error('Could not load preview frame:', err)
    }
    setParsedCommands((prev) =>
      prev.map((cmd, i) =>
        i === index
          ? { ...cmd, overlayImage: selected, overlayImageUrl, previewFrameUrl, customPosition: cmd.customPosition || { x: 50, y: 50 } }
          : cmd
      )
    )
  }

  const startDrag = (index) => (e) => {
    e.preventDefault()
    const container = e.currentTarget.parentElement
    const rect = container.getBoundingClientRect()

    const move = (moveEvent) => {
      const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX
      const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY
      let x = ((clientX - rect.left) / rect.width) * 100
      let y = ((clientY - rect.top) / rect.height) * 100
      x = Math.max(0, Math.min(100, x))
      y = Math.max(0, Math.min(100, y))
      setParsedCommands((prev) => prev.map((cmd, i) => (i === index ? { ...cmd, customPosition: { x, y } } : cmd)))
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const removeCommand = (index) => {
    setParsedCommands((prev) => prev.filter((_, i) => i !== index))
  }
  const [editingCommandIndex, setEditingCommandIndex] = useState(null)
  const [editCommandText, setEditCommandText] = useState('')

  const startEditCommand = (index) => {
    setEditingCommandIndex(index)
    setEditCommandText(parsedCommands[index].rawText)
  }

  const saveEditCommand = async (index) => {
    if (!editCommandText.trim()) return
    setParsingCommand(true)
    setError('')
    try {
      const res = await fetch('/api/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: editCommandText, videoDuration }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setParsedCommands((prev) =>
        prev.map((cmd, i) =>
          i === index ? { ...cmd, ...result, rawText: editCommandText } : cmd
        )
      )
      setEditingCommandIndex(null)
    } catch (err) {
      setError('Command update failed: ' + err.message)
    }
    setParsingCommand(false)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    setProgress('Uploading...')

    const filePath = `${session.user.id}/${Date.now()}_${file.name}`

    const { data, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, file)

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    setUploadedPath(filePath)
    setProgress('Uploaded successfully')
    setUploading(false)

    analyzeVideo(file)
  }
  const resetAll = () => {
    setReferenceFile(null)
    setReferenceStyle(null)
    setReferenceStep(true)
    setFile(null)
    setUploadedPath(null)
    setError('')
    setMood(null)
    setScript('')
    setEditingScript(false)
    setAudioUrl(null)
    setMusicTracks([])
    setSelectedTrack(null)
    setOwnMusicFile(null)
    setShowOwnMusicUpload(false)
    setRenderedVideoUrl(null)
    setRenderProgress(0)
    setCaptions([])
    setSavedProject(null)
    setHistoryError('')
    setCommandText('')
    setParsedCommands([])
    setVideoDuration(0)
  }


  const boxStyle = {
    display: 'block',
    border: '2px dashed #2E2A3F',
    borderRadius: '14px',
    padding: '36px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#1E1B2A',
  }

  const btnStyle = {
    flex: 1,
    padding: '10px',
    background: '#2E2A3F',
    border: 'none',
    borderRadius: '8px',
    color: '#F5F3FA',
    fontSize: '13px',
    cursor: 'pointer',
  }

  const primaryBtnStyle = {
    ...btnStyle,
    background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)',
    color: '#14121C',
    fontWeight: 600,
  }

  if (view === 'history') {
    return <History session={session} onBack={() => setView('editor')} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#14121C', color: '#F5F3FA', fontFamily: 'sans-serif', padding: '24px 20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {resumeDraft && (
          <div style={{ marginBottom: '16px', padding: '14px', background: '#1E1B2A', border: '2px solid #FF9F45', borderRadius: '10px' }}>
            <div style={{ fontSize: '13px', marginBottom: '10px' }}>You have an unfinished project. Resume it?</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={applyResumeDraft} style={{ flex: 1, padding: '8px', background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)', border: 'none', borderRadius: '8px', color: '#14121C', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>Resume</button>
              <button onClick={discardDraft} style={{ flex: 1, padding: '8px', background: '#2E2A3F', border: 'none', borderRadius: '8px', color: '#F5F3FA', fontSize: '12px', cursor: 'pointer' }}>Discard</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={17} color="#14121C" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.05em' }}>CLIP BAY</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setView('history')}
              style={{ background: 'none', border: 'none', color: '#6B6780', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
            >
              <Clock size={14} /> History
            </button>
            <button
              onClick={resetAll}
              style={{ background: 'none', border: 'none', color: '#6B6780', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
            >
              <RotateCcw size={14} /> Start over
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ background: 'none', border: 'none', color: '#6B6780', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>

        {referenceStep ? (
          <>
            <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>Reference video</h1>
            <p style={{ color: '#9691A8', fontSize: '14px', marginBottom: '24px' }}>
              Optional. Upload a video whose style (fonts, color, pacing, music vibe) you want to match. You can skip this.
            </p>

            <label htmlFor="reference-upload" style={boxStyle}>
              <Sparkles size={26} color="#6B6780" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', color: referenceFile ? '#F5F3FA' : '#9691A8' }}>
                {referenceFile ? referenceFile.name : 'Tap to choose a reference video'}
              </div>
              <input
                id="reference-upload"
                type="file"
                accept="video/*"
                onChange={handleReferenceSelect}
                style={{ display: 'none' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={skipReference} style={btnStyle}>
                Skip
              </button>
              <button
                onClick={analyzeReference}
                disabled={!referenceFile || analyzingReference}
                style={primaryBtnStyle}
              >
                {analyzingReference ? 'Analyzing style...' : 'Analyze style'}
              </button>
            </div>

            {error && <p style={{ color: '#FF5D8F', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
          </>
        ) : (
          <>
            {referenceStyle && (
              <div style={{ marginBottom: '20px', padding: '14px', background: '#1E1B2A', border: '2px solid #2E2A3F', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: '#FF9F45', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>
                  Style profile applied
                </div>
                <div style={{ fontSize: '12px', color: '#9691A8', lineHeight: '1.6' }}>
                  Font: {referenceStyle.fontStyle}<br />
                  Color: {referenceStyle.colorGrading}<br />
                  Pacing: {referenceStyle.pacing}<br />
                  Music vibe: {referenceStyle.musicMood}
                </div>
              </div>
            )}

            <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>Upload your clip</h1>
            <p style={{ color: '#9691A8', fontSize: '14px', marginBottom: '24px' }}>
              We'll analyze the footage and suggest a script that matches its mood.
            </p>

            <label htmlFor="video-upload" style={boxStyle}>
              <Upload size={26} color="#6B6780" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', color: file ? '#F5F3FA' : '#9691A8' }}>
                {file ? file.name : 'Tap to choose a video'}
              </div>
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>

            {file && !uploadedPath && (
              <button onClick={handleUpload} disabled={uploading} style={{ ...primaryBtnStyle, width: '100%', marginTop: '16px', padding: '13px' }}>
                {uploading ? progress : 'Upload video'}
              </button>
            )}

            {uploadedPath && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#1E1B2A', border: '2px solid #2E2A3F', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="#C6F135" />
                <span style={{ fontSize: '13px' }}>Uploaded successfully.</span>
              </div>
            )}

            {analyzing && (
              <div style={{ marginTop: '16px', textAlign: 'center', color: '#9691A8', fontSize: '13px' }}>
                Analyzing your footage...
              </div>
            )}

            {mood && !analyzing && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#1E1B2A', border: '2px solid #2E2A3F', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: '#FF9F45', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Mood: {mood}
                </div>
                {editingScript ? (
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    style={{ width: '100%', minHeight: '100px', background: '#14121C', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
                  />
                ) : (
                  <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{script}</p>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button onClick={() => analyzeVideo(file)} style={btnStyle}>Regenerate</button>
                  <button onClick={() => refineScript('make it noticeably shorter')} disabled={refiningScript} style={btnStyle}>Shorter</button>
                  <button onClick={() => refineScript('make it punchier and more energetic')} disabled={refiningScript} style={btnStyle}>Punchier</button>
                  <button onClick={() => refineScript('make it noticeably longer, add more detail')} disabled={refiningScript} style={btnStyle}>Longer</button>
                  <button onClick={() => setEditingScript(!editingScript)} style={btnStyle}>
                    {editingScript ? 'Done editing' : 'Write my own'}
                  </button>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2E2A3F' }}>
                  <div style={{ fontSize: '12px', color: '#9691A8', marginBottom: '10px' }}>Generate voiceover:</div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#6B6780', marginBottom: '4px' }}>Free voice:</div>
                    <select
                      value={openaiVoice}
                      onChange={(e) => setOpenaiVoice(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: '#14121C', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '8px', fontSize: '13px' }}
                    >
                      <option value="alloy">Alloy — neutral, balanced</option>
                      <option value="echo">Echo — warm, approachable</option>
                      <option value="fable">Fable — animated, energetic</option>
                      <option value="onyx">Onyx — deep, authoritative</option>
                      <option value="nova">Nova — bright, upbeat</option>
                      <option value="shimmer">Shimmer — calm, steady</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#6B6780', marginBottom: '4px' }}>Premium voice:</div>
                    <select
                      value={elevenlabsVoice}
                      onChange={(e) => setElevenlabsVoice(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: '#14121C', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '8px', fontSize: '13px' }}
                    >
                      <option value="21m00Tcm4TlvDq8ikWAM">Rachel — calm, narrative</option>
                      <option value="pNInz6obpgDQGcFmaJgB">Adam — deep, confident</option>
                      <option value="EXAVITQu4vr4xnSDxMaL">Bella — soft, friendly</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => generateVoice('openai')} disabled={generatingVoice} style={btnStyle}>
                      {generatingVoice ? 'Generating...' : 'Generate (Free)'}
                    </button>
                    <button onClick={() => generateVoice('elevenlabs')} disabled={generatingVoice} style={primaryBtnStyle}>
                      {generatingVoice ? 'Generating...' : 'Generate (Premium)'}
                    </button>
                  </div>
                  {audioUrl && <audio controls src={audioUrl} style={{ width: '100%', marginTop: '12px' }} />}

                  {captions.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#9691A8', marginBottom: '8px' }}>
                        Captions ({captions.length} lines, auto-burned in):
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <select
                          value={captionPosition}
                          onChange={(e) => setCaptionPosition(e.target.value)}
                          style={{ flex: 1, padding: '8px', background: '#14121C', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '8px', fontSize: '12px' }}
                        >
                          <option value="top">Position: Top</option>
                          <option value="center">Position: Center</option>
                          <option value="bottom">Position: Bottom</option>
                        </select>

                        <select
                          value={captionFont}
                          onChange={(e) => setCaptionFont(e.target.value)}
                          style={{ flex: 1, padding: '8px', background: '#14121C', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '8px', fontSize: '12px' }}
                        >
                          <option value="auto">Font: Auto (match reference)</option>
                          <option value="poppins">Font: Bold Sans</option>
                          <option value="anton">Font: Impact</option>
                          <option value="caveat">Font: Handwritten</option>
                          <option value="merriweather">Font: Serif</option>
                        </select>
                      </div>

                      <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#14121C', border: '1px solid #2E2A3F', borderRadius: '8px', padding: '8px' }}>
                        {captions.map((cap, i) => (
                          <div key={i} style={{ fontSize: '11px', color: '#6B6780', marginBottom: '4px' }}>
                            {cap.startSeconds?.toFixed(1)}s–{cap.endSeconds?.toFixed(1)}s: "{cap.text}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2E2A3F' }}>
                  <div style={{ fontSize: '12px', color: '#9691A8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Music size={13} /> Background music:
                  </div>

                  {loadingMusic && <div style={{ fontSize: '13px', color: '#9691A8' }}>Finding matching tracks...</div>}

                  {!loadingMusic && musicTracks.length > 0 && !showOwnMusicUpload && (
                    <div>
                      {musicTracks.map((track, i) => (
                        <div key={i} style={{ padding: '10px', background: '#14121C', border: selectedTrack?.name === track.name ? '1px solid #FF9F45' : '1px solid #2E2A3F', borderRadius: '8px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '13px', marginBottom: '6px' }}>{track.name} — {track.artist}</div>
                          <audio controls src={track.audioUrl} onLoadedMetadata={(e) => handleAudioLoaded(track.audioUrl, e)} style={{ width: '100%', height: '32px' }} />
                          <button
                            onClick={() => setSelectedTrack(track)}
                            style={{ ...btnStyle, marginTop: '6px', padding: '6px', fontSize: '12px', background: selectedTrack?.name === track.name ? '#FF9F45' : '#2E2A3F', color: selectedTrack?.name === track.name ? '#14121C' : '#F5F3FA' }}
                          >
                            {selectedTrack?.name === track.name ? 'Selected' : 'Use this track'}
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setShowOwnMusicUpload(true)} style={{ ...btnStyle, width: '100%', marginTop: '4px' }}>
                        None of these — upload my own
                      </button>
                    </div>
                  )}

                  {showOwnMusicUpload && (
                    <div>
                      <label htmlFor="own-music-upload" style={{ ...boxStyle, padding: '20px' }}>
                        <div style={{ fontSize: '13px', color: ownMusicFile ? '#F5F3FA' : '#9691A8' }}>
                          {ownMusicFile ? ownMusicFile.name : 'Tap to choose your own music file'}
                        </div>
                        <input
                          id="own-music-upload"
                          type="file"
                          accept="audio/*"
                          onChange={handleOwnMusicSelect}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {selectedTrack?.own && (
                        <audio controls src={selectedTrack.audioUrl} style={{ width: '100%', marginTop: '10px' }} />
                      )}
                      <button onClick={() => setShowOwnMusicUpload(false)} style={{ ...btnStyle, width: '100%', marginTop: '8px' }}>
                        Back to suggestions
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2E2A3F' }}>
                  <div style={{ fontSize: '12px', color: '#9691A8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wand2 size={13} /> Add overlays & effects (type a command):
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={commandText}
                      onChange={(e) => setCommandText(e.target.value)}
                      placeholder='e.g. "add sparkle overlay at 5 seconds, top right"'
                      style={{ flex: 1, padding: '10px', background: '#14121C', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '8px', fontSize: '13px' }}
                    />
                    <button onClick={submitCommand} disabled={parsingCommand || !commandText.trim()} style={{ ...primaryBtnStyle, flex: '0 0 auto', padding: '10px 14px' }}>
                      {parsingCommand ? '...' : 'Add'}
                    </button>
                  </div>

                  {parsedCommands.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      {parsedCommands.map((cmd, i) => (
                        <div key={i} style={{ padding: '10px', background: '#14121C', border: '1px solid #2E2A3F', borderRadius: '8px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#9691A8', marginBottom: '4px' }}>"{cmd.rawText}"</div>
                          <div style={{ fontSize: '12px', color: '#F5F3FA', marginBottom: '8px' }}>
                            {cmd.action === 'add_overlay' && `Overlay at ${cmd.timestampSeconds}s, ${cmd.position}, for ${cmd.durationSeconds}s`}
                            {cmd.action === 'add_effect' && `Effect "${cmd.effectType}" at ${cmd.timestampSeconds}s`}
                            {cmd.action === 'unknown' && 'Could not understand this command'}
                          </div>

                          {cmd.action === 'add_overlay' && (
                            <div style={{ marginBottom: '8px' }}>
                              <label
                                htmlFor={`overlay-image-${i}`}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', background: '#1E1B2A', border: '1px dashed #2E2A3F', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: cmd.overlayImage ? '#F5F3FA' : '#9691A8' }}
                              >
                                <ImageIcon size={14} />
                                {cmd.overlayImage ? cmd.overlayImage.name : 'Attach overlay image'}
                              </label>
                              <input
                                id={`overlay-image-${i}`}
                                type="file"
                                accept="image/*"
                                onChange={(e) => attachImageToCommand(i, e)}
                                style={{ display: 'none' }}
                              />
                              {cmd.action === 'add_overlay' && (
                            <div style={{ marginBottom: '8px' }}>
                              <label
  htmlFor={`overlay-image-${i}`}
  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', background: '#1E1B2A', border: '1px dashed #2E2A3F', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: cmd.overlayImage ? '#F5F3FA' : '#9691A8' }}
>
                                <ImageIcon size={14} />
                                {cmd.overlayImage ? cmd.overlayImage.name : 'Attach overlay image'}
                              </label>
                              <input
                                id={`overlay-image-${i}`}
                                type="file"
                                accept="image/*"
                                onChange={(e) => attachImageToCommand(i, e)}
                                style={{ display: 'none' }}
                              />
                              {cmd.overlayImageUrl && cmd.previewFrameUrl && (
  <div
    style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '9/16',
      maxHeight: '220px',
      backgroundImage: `url(${cmd.previewFrameUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      borderRadius: '8px',
      marginTop: '8px',
      overflow: 'hidden',
      touchAction: 'none',
    }}
  >
    <img
      src={cmd.overlayImageUrl}
      onPointerDown={startDrag(i)}
      style={{
        position: 'absolute',
        left: `${cmd.customPosition?.x ?? 50}%`,
        top: `${cmd.customPosition?.y ?? 50}%`,
        transform: 'translate(-50%, -50%)',
        width: '60px',
        height: '60px',
        objectFit: 'cover',
        borderRadius: '6px',
        border: '2px solid #FF9F45',
        cursor: 'grab',
      }}
    />
    <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '10px', color: '#F5F3FA', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>
      Drag to position
    </div>
  </div>
)}
                            </div>
                          )}
                            </div>
                          )}

                          {editingCommandIndex === i ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                value={editCommandText}
                                onChange={(e) => setEditCommandText(e.target.value)}
                                style={{ flex: 1, padding: '6px', background: '#1E1B2A', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '6px', fontSize: '12px' }}
                              />
                              <button onClick={() => saveEditCommand(i)} disabled={parsingCommand} style={{ ...btnStyle, padding: '4px 8px', fontSize: '11px' }}>Save</button>
                              <button onClick={() => setEditingCommandIndex(null)} style={{ ...btnStyle, padding: '4px 8px', fontSize: '11px' }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => startEditCommand(i)} style={{ ...btnStyle, padding: '4px', fontSize: '11px' }}>Edit</button>
                              <button onClick={() => removeCommand(i)} style={{ ...btnStyle, padding: '4px', fontSize: '11px' }}>Remove</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2E2A3F' }}>
                  <button onClick={handleRender} disabled={rendering} style={{ ...primaryBtnStyle, width: '100%', padding: '13px' }}>
                    {rendering ? `Rendering... ${renderProgress}%` : 'Render final video'}
                  </button>
                  {renderedVideoUrl && (
                    <>
                      <video controls src={renderedVideoUrl} style={{ width: '100%', marginTop: '12px', borderRadius: '8px' }} />
                      <a
                        href={renderedVideoUrl}
                        download={`clipbay_${Date.now()}.mp4`}
                        style={{ ...primaryBtnStyle, width: '100%', marginTop: '10px', padding: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Download size={16} /> Download video
                      </a>

                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#9691A8' }}>
                        {savingToHistory && <span>Saving to history...</span>}
                        {!savingToHistory && savedProject && (
                          <>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C6F135' }}>
                              <CheckCircle2 size={13} /> Saved to history
                            </span>
                            <button onClick={undoSaveToHistory} style={{ background: 'none', border: 'none', color: '#FF9F45', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                              Undo
                            </button>
                          </>
                        )}
                        {!savingToHistory && !savedProject && historyError && (
                          <span style={{ color: '#FF5D8F' }}>{historyError}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {error && <p style={{ color: '#FF5D8F', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}










                              
