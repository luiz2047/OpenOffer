import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStreamBuffer } from '../hooks/useStreamBuffer';
import { X, Copy, Check, Globe, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { genMessageId } from '../utils/messageId';
import openOfferIcon from './icon.png';
import { useTranslation } from 'react-i18next';
import type { ApplicationIntakeResult } from '../types/interviews';
import {
    detectTopSearchPasteIntent,
    resolveTopSearchProposalTarget,
    type TopSearchActionKind,
    type TopSearchProposalTargetReason,
    type VacancyTopSearchContext,
} from '../features/interviews/topSearchHelpers';

// ============================================
// Types
// ============================================

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

interface GlobalChatOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    initialQuery?: string;
    forceProposal?: boolean;
    vacancyContext?: VacancyTopSearchContext | null;
}

// ============================================
// Typing Indicator Component
// ============================================

const TypingIndicator: React.FC = () => (
    <div className="flex items-center gap-1 py-4">
        <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-text-tertiary"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut"
                    }}
                />
            ))}
        </div>
    </div>
);

// ============================================
// Message Components
// ============================================

const UserMessage: React.FC<{ content: string }> = ({ content }) => (
    <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex justify-end mb-6"
    >
        <div className="bg-[#2C2C2E] text-white px-5 py-3 rounded-2xl rounded-tr-md max-w-[70%] text-[15px] leading-relaxed">
            {content}
        </div>
    </motion.div>
);

const AssistantMessage: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-start mb-6"
        >
            <div className="text-text-primary text-[15px] leading-relaxed max-w-[85%]">
                {content}
                {isStreaming && (
                    <motion.span
                        className="inline-block w-0.5 h-4 bg-text-secondary ml-0.5 align-middle"
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                    />
                )}
            </div>
            {!isStreaming && content && (
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 mt-3 text-[13px] text-text-tertiary hover:text-text-secondary transition-colors"
                >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copied ? t('overlay.copied') : t('overlay.copyMessage')}
                </button>
            )}
        </motion.div>
    );
};

// ============================================
// Main Component
// ============================================

type ChatState = 'idle' | 'waiting_for_llm' | 'streaming_response' | 'error';
const CHAT_PROPOSAL_INPUT_CLASS = 'min-h-9 w-full rounded-md border border-white/[0.08] bg-black/20 px-2 text-[12px] outline-none focus:border-cyan-300/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60';

function shouldCreateChatProposal(question: string, vacancyContext?: VacancyTopSearchContext | null, forceProposal = false): boolean {
    if (!vacancyContext?.isActive) return false;
    if (forceProposal) return true;
    const trimmed = question.trim();
    if (!trimmed) return false;
    const intent = detectTopSearchPasteIntent(trimmed);
    return intent.intent !== 'unknown' || trimmed.length > 180 || trimmed.split(/\n/).length > 2;
}

function proposalActionFromQuestion(question: string): TopSearchActionKind {
    const intent = detectTopSearchPasteIntent(question);
    return intent.intent === 'stage' || (intent.stageScore > 0 && intent.stageScore >= intent.vacancyScore)
        ? 'add_stage_from_text'
        : 'parse_vacancy_source';
}

function buildVacancyChatContext(vacancyContext?: VacancyTopSearchContext | null): string | undefined {
    if (!vacancyContext?.isActive) return undefined;
    const selected = vacancyContext.rows.find(row => row.kind === 'vacancy' && row.id === vacancyContext.selectedApplicationId);
    const stages = vacancyContext.rows
        .filter(row => row.kind === 'stage' && (!vacancyContext.selectedApplicationId || row.applicationId === vacancyContext.selectedApplicationId))
        .slice(0, 8);
    const candidates = vacancyContext.candidateApplications.slice(0, 8);
    const lines = [
        'OPENOFFER LOCAL VACANCY CONTEXT:',
        selected
            ? `Current vacancy: ${[selected.title, selected.company, selected.roleTitle].filter(Boolean).join(' · ')}`
            : 'Current vacancy: none selected',
    ];
    if (stages.length) {
        lines.push('Known stages:');
        for (const stage of stages) {
            lines.push(`- ${[stage.title, stage.company, stage.roleTitle].filter(Boolean).join(' · ')} | status=${stage.status} | startsAt=${stage.startsAt ?? 'none'}`);
        }
    }
    if (candidates.length) {
        lines.push('Candidate vacancies:');
        for (const candidate of candidates) {
            lines.push(`- ${candidate.id}: ${[candidate.title, candidate.company, candidate.roleTitle].filter(Boolean).join(' · ')}`);
        }
    }
    lines.push('Use this as local app context. Do not write application or stage data unless the user approves an explicit proposal.');
    return lines.join('\n');
}

const GlobalChatOverlay: React.FC<GlobalChatOverlayProps> = ({
    isOpen,
    onClose,
    initialQuery = '',
    forceProposal = false,
    vacancyContext = null,
}) => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatState, setChatState] = useState<ChatState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [proposalState, setProposalState] = useState<'idle' | 'parsing' | 'proposal' | 'applying' | 'success' | 'error'>('idle');
    const [proposalAction, setProposalAction] = useState<TopSearchActionKind>('parse_vacancy_source');
    const [proposal, setProposal] = useState<ApplicationIntakeResult | null>(null);
    const [targetApplicationId, setTargetApplicationId] = useState('');
    const [proposalTargetReason, setProposalTargetReason] = useState<TopSearchProposalTargetReason>('none');
    const [proposalError, setProposalError] = useState<string | null>(null);
    const streamBuffer = useStreamBuffer();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatWindowRef = useRef<HTMLDivElement>(null);
    const vacancyChatContext = useMemo(() => buildVacancyChatContext(vacancyContext), [vacancyContext]);

    // Submit initial query when overlay opens
    useEffect(() => {
        if (isOpen && initialQuery && messages.length === 0) {
            setTimeout(() => {
                submitQuestion(initialQuery);
            }, 100);
        }
    }, [isOpen, initialQuery]);

    // Listen for new queries from parent
    useEffect(() => {
        if (isOpen && initialQuery && messages.length > 0) {
            // This is a follow-up query
            submitQuestion(initialQuery);
        }
    }, [initialQuery]);

    // ESC key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Click outside handler
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && query.trim()) {
            e.preventDefault();
            submitQuestion(query);
            setQuery('');
        }
    };

    const resetProposal = useCallback(() => {
        setProposalState('idle');
        setProposalAction('parse_vacancy_source');
        setProposal(null);
        setTargetApplicationId('');
        setProposalTargetReason('none');
        setProposalError(null);
    }, []);

    const startProposalFlow = useCallback(async (question: string): Promise<boolean> => {
        if (!shouldCreateChatProposal(question, vacancyContext, forceProposal)) return false;
        const action = proposalActionFromQuestion(question);
        setProposalAction(action);
        setProposalState('parsing');
        setProposal(null);
        setTargetApplicationId('');
        setProposalTargetReason('none');
        setProposalError(null);
        setChatState('idle');

        try {
            const preview = await vacancyContext!.onPreviewIntake({
                text: question,
                useAi: true,
                task: 'agent_actions',
                candidateApplicationIds: vacancyContext!.candidateApplications.map(candidate => candidate.id),
            });
            const targetResolution = resolveTopSearchProposalTarget(preview, vacancyContext!.rows);
            setProposal(preview);
            setTargetApplicationId(preview.stage && targetResolution.selectedApplicationId ? targetResolution.selectedApplicationId : '');
            setProposalTargetReason(preview.stage ? targetResolution.reason : 'none');
            setProposalState('proposal');
        } catch (error: any) {
            setProposalError(error?.message || t('topSearch.errors.parseFailed'));
            setProposalState('error');
        }
        return true;
    }, [forceProposal, t, vacancyContext]);

    const updateApplicationField = useCallback((field: keyof ApplicationIntakeResult['application'], value: string) => {
        setProposal(prev => prev ? { ...prev, application: { ...prev.application, [field]: value } } : prev);
    }, []);

    const updateStageField = useCallback((field: keyof NonNullable<ApplicationIntakeResult['stage']>, value: string) => {
        setProposal(prev => prev?.stage ? { ...prev, stage: { ...prev.stage, [field]: value } } : prev);
    }, []);

    const applyProposal = useCallback(async () => {
        if (!proposal || !vacancyContext?.isActive) return;
        const requiresTarget = proposalAction === 'add_stage_from_text' && !!proposal.stage;
        if (requiresTarget && !targetApplicationId) return;
        setProposalState('applying');
        setProposalError(null);
        try {
            await vacancyContext.onApplyIntake(proposal, {
                selectedApplicationId: proposal.stage && targetApplicationId ? targetApplicationId : null,
            });
            setProposalState('success');
            setMessages(prev => [...prev, {
                id: genMessageId(),
                role: 'assistant',
                content: t('topSearch.proposal.applied'),
            }]);
            window.setTimeout(onClose, 500);
        } catch (error: any) {
            setProposalError(error?.message || t('topSearch.errors.applyFailed'));
            setProposalState('error');
        }
    }, [onClose, proposal, proposalAction, targetApplicationId, t, vacancyContext]);

    // Submit question using global RAG
    const submitQuestion = useCallback(async (question: string) => {
        if (!question.trim() || chatState === 'waiting_for_llm' || chatState === 'streaming_response') return;

        const userMessage: Message = {
            id: genMessageId(),
            role: 'user',
            content: question
        };
        setMessages(prev => [...prev, userMessage]);
        setChatState('waiting_for_llm');
        setErrorMessage(null);
        resetProposal();

        // Scroll to bottom when user sends message
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);

        const assistantMessageId = genMessageId();

        try {
            const handledByProposal = await startProposalFlow(question);
            if (handledByProposal) return;

            // Add typing indicator delay (200ms) - makes the AI feel "thoughtful"
            await new Promise(resolve => setTimeout(resolve, 200));

            // Create assistant message placeholder
            setMessages(prev => [...prev, {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                isStreaming: true
            }]);

            // Set up RAG streaming listeners (RAF-batched)
            streamBuffer.reset();
            const tokenCleanup = window.electronAPI?.onRAGStreamChunk((data: { chunk: string }) => {
                setChatState('streaming_response');
                streamBuffer.appendToken(data.chunk, (content) => {
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, content }
                            : msg
                    ));
                });
            });

            const doneCleanup = window.electronAPI?.onRAGStreamComplete(() => {
                const finalContent = streamBuffer.getBufferedContent();
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                        ? { ...msg, content: finalContent, isStreaming: false }
                        : msg
                ));
                setChatState('idle');
                streamBuffer.reset();
                tokenCleanup?.();
                doneCleanup?.();
                errorCleanup?.();
            });

            const errorCleanup = window.electronAPI?.onRAGStreamError((data: { error: string }) => {
                console.error('[GlobalChat] RAG stream error:', data.error);
                setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                setErrorMessage(t('overlay.responseTryAgain'));
                setChatState('error');
                streamBuffer.reset();
                tokenCleanup?.();
                doneCleanup?.();
                errorCleanup?.();
            });

            // Use global RAG query
            const result = await window.electronAPI?.ragQueryGlobal(question);

            if (result?.fallback) {
                console.log("[GlobalChat] RAG unavailable, falling back to standard chat");
                // Cleanup RAG listeners
                tokenCleanup?.();
                doneCleanup?.();
                errorCleanup?.();

                // Setup fallback listeners (Standard Gemini)
                streamBuffer.reset();
                const oldTokenCleanup = window.electronAPI?.onGeminiStreamToken((token: string) => {
                    setChatState('streaming_response');
                    streamBuffer.appendToken(token, (content) => {
                        setMessages(prev => prev.map(msg =>
                            msg.id === assistantMessageId
                                ? { ...msg, content }
                                : msg
                        ));
                    });
                });

                const oldDoneCleanup = window.electronAPI?.onGeminiStreamDone(() => {
                    const finalContent = streamBuffer.getBufferedContent();
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, content: finalContent, isStreaming: false }
                            : msg
                    ));
                    setChatState('idle');
                    streamBuffer.reset();
                    oldTokenCleanup?.();
                    oldDoneCleanup?.();
                    oldErrorCleanup?.();
                });

                const oldErrorCleanup = window.electronAPI?.onGeminiStreamError((error: string) => {
                    console.error('[GlobalChat] Gemini stream error:', error);
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                    setErrorMessage(t('overlay.responseCheckSettings'));
                    setChatState('error');
                    streamBuffer.reset();
                    oldTokenCleanup?.();
                    oldDoneCleanup?.();
                    oldErrorCleanup?.();
                });

                // Call standard chat
                await window.electronAPI?.streamGeminiChat(question, undefined, vacancyChatContext, { skipSystemPrompt: false });
            }

        } catch (error) {
            console.error('[GlobalChat] Error:', error);
            setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
            setErrorMessage(t('overlay.responseSomethingWrong'));
            setChatState('error');
        }
    }, [chatState, resetProposal, startProposalFlow, streamBuffer, t, vacancyChatContext]);

    const requiresTarget = proposalAction === 'add_stage_from_text' && !!proposal?.stage;
    const applyDisabled = proposalState === 'applying' || !proposal || (requiresTarget && !targetApplicationId);
    const targetSelectionMessage = requiresTarget && !targetApplicationId
        ? t(`topSearch.proposal.targetReasons.${proposalTargetReason === 'none' ? 'no_match' : proposalTargetReason}`)
        : null;

    return (
        <AnimatePresence
            onExitComplete={() => {
                setChatState('idle');
                setMessages([]);
                setErrorMessage(null);
                resetProposal();
            }}
        >
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="absolute inset-0 z-40 flex flex-col justify-end"
                    onClick={handleBackdropClick}
                >
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ backdropFilter: 'blur(0px)' }}
                        animate={{ backdropFilter: 'blur(8px)' }}
                        exit={{ backdropFilter: 'blur(0px)' }}
                        transition={{ duration: 0.16 }}
                        className="absolute inset-0 bg-black/40"
                    />

                    {/* Chat Window */}
                    <motion.div
                        ref={chatWindowRef}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "85vh", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            height: { type: "spring", stiffness: 300, damping: 30, mass: 0.8 },
                            opacity: { duration: 0.2 }
                        }}
                        className="relative mx-auto w-full max-w-[680px] mb-0 bg-bg-secondary rounded-t-[24px] border-t border-x border-border-subtle shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
                            <div className="flex items-center gap-2 text-text-tertiary">
                                <img src={openOfferIcon} className="w-3.5 h-3.5 force-black-icon opacity-50" alt="OpenOffer" />
                                <span className="text-[13px] font-medium">{t('search.placeholder')}</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 transition-colors group"
                            >
                                <X size={16} className="text-text-tertiary group-hover:text-red-500 group-hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all duration-300" />
                            </button>
                        </div>

                        {/* Messages area - scrollable */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 pb-32 custom-scrollbar">
                            {messages.map((msg) => (
                                msg.role === 'user'
                                    ? <UserMessage key={msg.id} content={msg.content} />
                                    : <AssistantMessage key={msg.id} content={msg.content} isStreaming={msg.isStreaming} />
                            ))}

                            {chatState === 'waiting_for_llm' && <TypingIndicator />}

                            {errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-[#FF6B6B] text-[13px] py-2"
                                >
                                    {errorMessage}
                                </motion.div>
                            )}

                            {(proposalState === 'parsing' || proposalState === 'proposal' || proposalState === 'applying' || proposalState === 'success' || proposalState === 'error') && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-6 max-w-[92%] rounded-xl border border-cyan-300/20 bg-cyan-300/[0.055] p-4"
                                    data-testid="top-search-proposal"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[13px] font-semibold text-cyan-100">
                                                {proposalState === 'success'
                                                    ? t('topSearch.proposal.applied')
                                                    : proposalState === 'parsing'
                                                        ? t('topSearch.proposal.parsing')
                                                        : t('topSearch.proposal.ready')}
                                            </div>
                                            <div className="mt-1 text-[11px] text-text-tertiary">
                                                {proposal
                                                    ? t('topSearch.proposal.confidence', { value: Math.round(proposal.confidence * 100) })
                                                    : t('topSearch.proposal.noWriteUntilApply')}
                                            </div>
                                        </div>
                                        <button type="button" className="text-[11px] font-semibold text-text-secondary hover:text-white" onClick={resetProposal}>
                                            {t('topSearch.proposal.clear')}
                                        </button>
                                    </div>

                                    {proposalError && <div className="mt-2 text-[12px] text-red-300">{proposalError}</div>}

                                    {proposal && (
                                        <div className="mt-3 space-y-2 text-[12px]">
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <label className="block">
                                                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.title')}</span>
                                                    <input className={CHAT_PROPOSAL_INPUT_CLASS} value={proposal.application.title ?? ''} onChange={event => updateApplicationField('title', event.target.value)} />
                                                </label>
                                                <label className="block">
                                                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.company')}</span>
                                                    <input className={CHAT_PROPOSAL_INPUT_CLASS} value={proposal.application.company ?? ''} onChange={event => updateApplicationField('company', event.target.value)} />
                                                </label>
                                                <label className="block">
                                                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.role')}</span>
                                                    <input className={CHAT_PROPOSAL_INPUT_CLASS} value={proposal.application.roleTitle ?? ''} onChange={event => updateApplicationField('roleTitle', event.target.value)} />
                                                </label>
                                                {proposal.stage && (
                                                    <label className="block">
                                                        <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.stage')}</span>
                                                        <input className={CHAT_PROPOSAL_INPUT_CLASS} value={proposal.stage.title ?? ''} onChange={event => updateStageField('title', event.target.value)} />
                                                    </label>
                                                )}
                                            </div>
                                            {proposal.stage && vacancyContext?.candidateApplications.length ? (
                                                <label className="block">
                                                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-text-tertiary">{t('topSearch.proposal.fields.attachToVacancy')}</span>
                                                    <select className={CHAT_PROPOSAL_INPUT_CLASS} value={targetApplicationId} onChange={event => setTargetApplicationId(event.target.value)}>
                                                        <option value="">{proposalAction === 'add_stage_from_text' ? t('topSearch.proposal.placeholders.enableApply') : t('topSearch.proposal.placeholders.createNewVacancy')}</option>
                                                        {vacancyContext.candidateApplications.map(candidate => (
                                                            <option key={candidate.id} value={candidate.id}>
                                                                {[candidate.title, candidate.company, candidate.roleTitle].filter(Boolean).join(' · ')}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            ) : null}
                                            {targetSelectionMessage && (
                                                <div className="text-[11px] text-amber-200">{targetSelectionMessage}</div>
                                            )}
                                            {proposal.warnings.length > 0 && (
                                                <div className="text-[11px] text-amber-200">{proposal.warnings.join(', ')}</div>
                                            )}
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    data-testid="top-search-apply-proposal"
                                                    onClick={applyProposal}
                                                    disabled={applyDisabled}
                                                    className="min-h-10 rounded-md bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    {proposalState === 'applying'
                                                        ? t('topSearch.proposal.actions.applying')
                                                        : proposalAction === 'add_stage_from_text'
                                                            ? t('topSearch.proposal.actions.addStage')
                                                            : proposal.stage
                                                                ? t('topSearch.proposal.actions.createVacancyStage')
                                                                : t('topSearch.proposal.actions.createVacancy')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Floating Footer (Ask Bar) */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center z-50 pointer-events-none">
                            <div className="w-full max-w-[440px] relative group pointer-events-auto">
                                {/* Dark Glass Effect Input */}
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleInputKeyDown}
                                    placeholder={t('overlay.askMeAnything')}
                                    className="w-full pl-5 pr-12 py-3 bg-bg-elevated shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border-muted rounded-full text-sm text-text-primary placeholder-text-tertiary/70 focus:outline-none transition-all"
                                />
                                <button
                                    onClick={() => {
                                        if (query.trim()) {
                                            submitQuestion(query);
                                            setQuery('');
                                        }
                                    }}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all duration-200 border border-white/5 ${query.trim() ? 'bg-text-primary text-bg-primary hover:scale-105' : 'bg-bg-item-active text-text-primary hover:bg-bg-item-hover'
                                        }`}
                                >
                                    <ArrowUp size={16} className="transform rotate-45" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default GlobalChatOverlay;
