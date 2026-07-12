import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Upload, Film, LogOut, CheckCircle2, Sparkles, Music, Wand2, Image as ImageIcon } from 'lucide-react'
import { extractFrames } from '../extractFrames'
import { renderVideoWithOverlays } from '../videoRenderer'
export default function UploadVideo({ session }) {
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
  const [generatingVoice, setGeneratingVoice] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [openaiVoice, setOpenaiVoice] = useState('alloy')
  const [elevenlabsVoice, setElevenlabsVoice] = useState('21m00Tcm4TlvDq8ikWAM')
  const [loadingMusic, setLoadingMusic] = useState(false)
  const [musicTracks, setMusicTracks] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [ownMusicFile, setOwnMusicFile] = useState(null)
  const [showOwnMusicUpload, setShowOwnMusicUpload] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderedVideoUrl, setRenderedVideoUrl] = useState(null)

  const handleRender = async () => {
    setRendering(true)
    setRenderProgress(0)
    setError('')
    try {
      const url = await renderVideoWithOverlays(file, parsedCommands, { voiceoverUrl: audioUrl, musicUrl: selectedTrack?.audioUrl }, referenceStyle?.colorValues, videoDuration, null, setRenderProgress)
      setRenderedVideoUrl(url)
    } catch (err) {
      setError('Rendering failed: ' + err.message)
    }
    setRendering(false)
  }
  const [commandText, setCommandText] = useState('')
  const [parsingCommand, setParsingCommand] = useState(false)
  const [parsedCommands, setParsedCommands] = useState([])
  const [videoDuration, setVideoDuration] = useState(0)

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
        body: JSON.stringify({ frames }),
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
        body: JSON.stringify({ mood: searchMood }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setMusicTracks(result.tracks || [])
    } catch (err) {
      setError('Music suggestion failed: ' + err.message)
    }
    setLoadingMusic(false)
  }

  const handleOwnMusicSelect = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setOwnMusicFile(selected)
      setSelectedTrack({ name: selected.name, own: true, audioUrl: URL.createObjectURL(selected) })
    }
  }

  const generateVoice = async (provider) => {
    setGeneratingVoice(true)
    setError('')
    setAudioUrl(null)
    try {
      const res = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, provider, voice: provider === 'openai' ? openaiVoice : elevenlabsVoice }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      const audioSrc = `data:${result.mimeType};base64,${result.audio}`
      setAudioUrl(audioSrc)
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

  const attachImageToCommand = (index, e) => {
    const selected = e.target.files[0]
    if (!selected) return
    setParsedCommands((prev) =>
      prev.map((cmd, i) =>
        i === index ? { ...cmd, overlayImage: selected, overlayImageUrl: URL.createObjectURL(selected) } : cmd
      )
    )
  }

  const removeCommand = (index) => {
    setParsedCommands((prev) => prev.filter((_, i) => i !== index))
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

  return (
    <div style={{ minHeight: '100vh', background: '#14121C', color: '#F5F3FA', fontFamily: 'sans-serif', padding: '24px 20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={17} color="#14121C" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.05em' }}>CLIP BAY</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'none', border: 'none', color: '#6B6780', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
          >
            <LogOut size={14} /> Log out
          </button>
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
                          <audio controls src={track.audioUrl} style={{ width: '100%', height: '32px' }} />
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
                              {cmd.overlayImageUrl && (
                                <img src={cmd.overlayImageUrl} alt="overlay preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', marginTop: '6px' }} />
                              )}
                            </div>
                          )}

                          <button onClick={() => removeCommand(i)} style={{ ...btnStyle, padding: '4px', fontSize: '11px' }}>
                            Remove
                          </button>
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
                    <video controls src={renderedVideoUrl} style={{ width: '100%', marginTop: '12px', borderRadius: '8px' }} />
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










                              
