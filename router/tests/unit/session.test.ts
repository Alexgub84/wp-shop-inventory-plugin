import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSessionManager } from '../../src/session/manager.js'

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should create a new session', () => {
    const manager = createSessionManager(300000)
    const session = manager.createSession('user@c.us')

    expect(session.chatId).toBe('user@c.us')
    expect(session.action).toBe('addProduct')
    expect(session.step).toBe('name')
    expect(session.data).toEqual({})
  })

  it('should store and retrieve a session', () => {
    const manager = createSessionManager(300000)
    const session = manager.createSession('user@c.us')
    manager.set('user@c.us', session)

    const retrieved = manager.get('user@c.us')
    expect(retrieved).toBeDefined()
    expect(retrieved!.chatId).toBe('user@c.us')
  })

  it('should return undefined for non-existent session', () => {
    const manager = createSessionManager(300000)
    expect(manager.get('unknown@c.us')).toBeUndefined()
  })

  it('should delete a session', () => {
    const manager = createSessionManager(300000)
    const session = manager.createSession('user@c.us')
    manager.set('user@c.us', session)

    manager.delete('user@c.us')
    expect(manager.get('user@c.us')).toBeUndefined()
  })

  it('should return undefined for expired sessions', () => {
    const manager = createSessionManager(5000)
    const session = manager.createSession('user@c.us')
    manager.set('user@c.us', session)

    vi.advanceTimersByTime(6000)

    expect(manager.get('user@c.us')).toBeUndefined()
  })

  it('should refresh expiry on set', () => {
    const manager = createSessionManager(5000)
    const session = manager.createSession('user@c.us')
    manager.set('user@c.us', session)

    vi.advanceTimersByTime(3000)

    session.step = 'price'
    manager.set('user@c.us', session)

    vi.advanceTimersByTime(3000)

    const retrieved = manager.get('user@c.us')
    expect(retrieved).toBeDefined()
    expect(retrieved!.step).toBe('price')
  })

  it('should clean up expired sessions', () => {
    const manager = createSessionManager(5000)

    const s1 = manager.createSession('user1@c.us')
    manager.set('user1@c.us', s1)

    vi.advanceTimersByTime(3000)

    const s2 = manager.createSession('user2@c.us')
    manager.set('user2@c.us', s2)

    vi.advanceTimersByTime(3000)

    manager.cleanup()

    expect(manager.get('user1@c.us')).toBeUndefined()
    expect(manager.get('user2@c.us')).toBeDefined()
  })
})
