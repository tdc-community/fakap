import { type ReactElement, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ArrowBigDown,
  ArrowBigUp,
  Plus,
  Pencil,
  Settings,
  Gavel,
  Home,
  LogIn,
  LogOut,
  Trophy,
  UserCog,
  X,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  useSessionUser,
  type AppRole,
} from '@features/auth';
import { AdminWorkspace } from '@features/admin';
import { NewsDetail, NewsLanding } from '@features/news';
import type { AppSection } from '@shared/types';
import { useAppLayoutSessionEffects } from './hooks/useAppLayoutSessionEffects';
import { useAccountMenuController } from './hooks/useAccountMenuController';
import { useWalletAccountController } from './hooks/useWalletAccountController';
import { useWalletTransactions } from './hooks/useWalletTransactions';
import { useVehicleFeedController } from './hooks/useVehicleFeedController';

type AppProps = {
  section?: AppSection;
  newsId?: string;
};

type NavItem = {
  label: string;
  href: string;
  section: AppSection;
  roles: Array<'guest' | AppRole>;
  icon: ReactElement;
};

const navItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    section: 'home',
    roles: ['guest', 'user', 'moderator', 'admin'],
    icon: <Home size={16} />,
  },
  {
    label: 'Vehicles',
    href: '/vehicles',
    section: 'vehicles',
    roles: ['guest', 'user', 'moderator', 'admin'],
    icon: <Car size={16} />,
  },
  {
    label: 'Auctions',
    href: '/auctions',
    section: 'auctions',
    roles: ['guest', 'user', 'moderator', 'admin'],
    icon: <Gavel size={16} />,
  },
  {
    label: 'Contests',
    href: '/contests',
    section: 'contests',
    roles: ['guest', 'user', 'moderator', 'admin'],
    icon: <Trophy size={16} />,
  },
  {
    label: 'Admin',
    href: '/admin',
    section: 'admin',
    roles: ['admin'],
    icon: <UserCog size={16} />,
  },
];

const editorItems: NavItem[] = [
  {
    label: 'Workspace',
    href: '/editor/news',
    section: 'editor-news',
    roles: ['moderator', 'admin'],
    icon: <BookOpen size={16} />,
  },
  {
    label: 'Manage Events',
    href: '/editor/events',
    section: 'editor-events',
    roles: ['moderator', 'admin'],
    icon: <Calendar size={16} />,
  },
  {
    label: 'Manage Auctions',
    href: '/editor/auctions',
    section: 'editor-auctions',
    roles: ['moderator', 'admin'],
    icon: <Gavel size={16} />,
  },
  {
    label: 'Manage Contests',
    href: '/editor/contests',
    section: 'editor-contests',
    roles: ['moderator', 'admin'],
    icon: <Trophy size={16} />,
  },
];

export function AppLayout({ section }: AppProps): ReactElement {
  const current = section ?? 'home';
  const params = useParams<{ id?: string }>();
  const { sessionUser, setSessionUser, authChecked } = useSessionUser();

  const {
    walletBalance,
    setWalletBalance,
    icCharacterName,
    setIcCharacterName,
    profileImageDataUrl,
    setProfileImageDataUrl,
    bankAccountId,
    setBankAccountId,
  } = useAppLayoutSessionEffects(sessionUser);

  const {
    busy,
    accountOpen,
    setAccountOpen,
    handleLogin,
    handleLogout,
  } = useAccountMenuController({
    setSessionUser,
    setWalletBalance,
  });

  const {
    saveState,
    withdrawAmount,
    setWithdrawAmount,
    withdrawState,
    withdrawMessage,
    walletIbanVisible,
    setWalletIbanVisible,
    walletIbanEditing,
    walletIbanState,
    walletIbanMessage,
    handleProfileFileChange,
    handleSaveProfile,
    handleWithdraw,
    handleWalletIbanSave,
    startWalletIbanEditing,
    handleWalletIbanCancel,
  } = useWalletAccountController({
    sessionUser,
    setSessionUser,
    setWalletBalance,
    icCharacterName,
    profileImageDataUrl,
    setProfileImageDataUrl,
    bankAccountId,
    setBankAccountId,
  });

  const { txFilter, setTxFilter, txState, filteredTransactions } = useWalletTransactions({
    current,
    sessionUser,
  });

  const role: 'guest' | AppRole = sessionUser?.role ?? 'guest';
  const visibleNav = useMemo(() => navItems.filter((item) => item.roles.includes(role)), [role]);
  const visibleEditor = useMemo(() => editorItems.filter((item) => item.roles.includes(role)), [role]);


  const {
    vehicleState,
    vehicleItems,
    vehicleModalOpen,
    setVehicleModalOpen,
    vehicleTitle,
    setVehicleTitle,
    vehicleDescription,
    setVehicleDescription,
    vehicleModalImages,
    vehicleFormState,
    setVehicleFormState,
    vehicleFormMessage,
    setVehicleFormMessage,
    vehicleImageError,
    setVehicleImageError,
    vehicleDeleteState,
    vehicleDeleteError,
    lightbox,
    setLightbox,
    vehicleModalRef,
    vehicleModalFirstInputRef,
    handleCreateVehiclePost,
    handleVehicleImagesSelected,
    removeVehicleImage,
    openLightbox,
    handleVoteVehiclePost,
    handleDeleteVehiclePost,
    activeLightboxPost,
    activeLightboxImages,
    activeLightboxIndex,
    canModerateVehicles,
  } = useVehicleFeedController({
    current,
    authChecked,
    sessionUser,
    role,
  });

  return (
    <div className="layout">
      <header className="topbar">
        <div className="top-left-group">
          <div className="brand brand-left">
            <span>FAKA PERFORMANCE</span>
          </div>
          <span className="top-divider" aria-hidden="true" />
          <nav className="top-nav" aria-label="Primary">
            {[...visibleNav, ...visibleEditor].map((item) => (
              <a key={item.href} className={`top-link ${item.section === current ? 'active' : ''}`} href={item.href}>
                {item.icon}
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </div>

        <div className="top-actions">
          {!authChecked ? (
            <div className="auth-placeholder" aria-hidden="true" />
          ) : !sessionUser ? (
            <button type="button" className="btn btn-ghost" onClick={() => void handleLogin()} disabled={busy}>
              <LogIn size={16} />
              Login
            </button>
          ) : (
            <div className="account-wrap">
              <button
                type="button"
                className="account-bubble"
                onClick={() => setAccountOpen((v) => !v)}
                disabled={busy}
                aria-label="Open account menu"
              >
                {sessionUser.profileImageUrl ?? sessionUser.avatarUrl ? (
                  <img
                    src={sessionUser.profileImageUrl ?? sessionUser.avatarUrl ?? undefined}
                    alt={sessionUser.username}
                    className="account-avatar"
                  />
                ) : (
                  <span className="account-avatar-fallback">{sessionUser.username.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="account-chevron">
                  <ChevronDown size={14} />
                </span>
              </button>
              {accountOpen ? (
                <div className="account-menu">
                  <div className="account-header">
                    {sessionUser.profileImageUrl ?? sessionUser.avatarUrl ? (
                      <img
                        src={sessionUser.profileImageUrl ?? sessionUser.avatarUrl ?? undefined}
                        alt={sessionUser.username}
                        className="account-avatar menu"
                      />
                    ) : (
                      <span className="account-avatar-fallback menu">{sessionUser.username.slice(0, 1).toUpperCase()}</span>
                    )}
                    <div>
                      <strong>{sessionUser.username}</strong>
                      <div className="muted">Account</div>
                    </div>
                  </div>
                  <div className="account-row">
                    <span className="muted">Role</span>
                    <span className="role-pill">{role.toUpperCase()}</span>
                  </div>
                  <div className="account-actions-row">
                    <a className="wallet-link" href="/wallet" onClick={() => setAccountOpen(false)}>
                      <CircleDollarSign size={15} />
                      Wallet
                    </a>
                    <a className="account-link" href="/account/settings" onClick={() => setAccountOpen(false)}>
                      <Settings size={15} />
                      Settings
                    </a>
                  </div>
                  <button type="button" className="btn btn-solid" onClick={() => void handleLogout()} disabled={busy}>
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>

      <main className="main">
        <div className="content-wrap">
        {current === 'home' ? <NewsLanding /> : null}

        {current === 'news-detail' ? <NewsDetail id={params.id ?? ''} /> : null}

        {current === 'vehicles' ? (
          <section className={`vehicles-page ${!sessionUser ? 'auth-only' : ''}`}>
            {!authChecked ? (
              <section className="card auth-panel">
                <h2 style={{ marginTop: 0 }}>Vehicles</h2>
                <p className="muted">Checking session...</p>
              </section>
            ) : !sessionUser ? (
              <section className="card auth-panel">
                <h2 style={{ marginTop: 0 }}>Vehicles</h2>
                <p className="muted">You must be logged in to view vehicle posts and vote.</p>
                <div className="row action-row">
                  <button type="button" className="btn btn-solid" onClick={() => void handleLogin()} disabled={busy}>
                    <LogIn size={16} />
                    Login with Discord
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="card vehicle-feed" aria-labelledby="vehicle-feed-title">
                  <h2 id="vehicle-feed-title" style={{ marginTop: 0 }}>
                    Community Vehicles
                  </h2>
                  <p className="muted vehicle-feed-intro">Top scored builds stay at the top. Equal score posts are sorted by newest first.</p>

                  {vehicleState === 'loading' ? <p className="muted">Loading vehicle posts...</p> : null}
                  {vehicleState === 'error' ? <p className="save-error">Could not load vehicle posts.</p> : null}
                  {vehicleState === 'empty' ? <p className="muted">No posts yet. Be the first to submit a car.</p> : null}

                  {vehicleState === 'ready' ? (
                    <ul className="vehicle-list" aria-live="polite">
                      {vehicleItems.map((post) => {
                        const score = post.upvotes - post.downvotes;
                        return (
                          <li key={post.id} className="vehicle-item">
                            <div className="vehicle-votes" aria-label={`Score ${score}`}>
                              <button
                                className={`vote-btn ${post.viewerVote === 1 ? 'active-up' : ''}`}
                                onClick={() => void handleVoteVehiclePost(post, 1)}
                                aria-label="Upvote"
                              >
                                <ArrowBigUp size={16} />
                              </button>
                              <strong className="vehicle-score" aria-label={`Score ${score}`}>{score}</strong>
                              <button
                                className={`vote-btn ${post.viewerVote === -1 ? 'active-down' : ''}`}
                                onClick={() => void handleVoteVehiclePost(post, -1)}
                                aria-label="Downvote"
                              >
                                <ArrowBigDown size={16} />
                              </button>
                            </div>

                            <button className="vehicle-image-button" onClick={() => void openLightbox(post, 0)} aria-label={`Open ${post.title} gallery`}>
                              <img src={post.imageUrls[0]} alt={post.title} className="vehicle-image" />
                            </button>

                             <div className="vehicle-content">
                               {canModerateVehicles ? (
                                 <div className="vehicle-card-tools">
                                   <button
                                     type="button"
                                     className="icon-btn vehicle-card-remove"
                                     aria-label={`Remove ${post.title}`}
                                     disabled={vehicleDeleteState === 'submitting'}
                                     onClick={() => {
                                       if (window.confirm(`Remove vehicle post “${post.title}”?`)) {
                                         void handleDeleteVehiclePost(post);
                                       }
                                     }}
                                   >
                                     <X size={15} />
                                   </button>
                                 </div>
                               ) : null}
                               <h3>{post.title}</h3>
                               <p className="muted">{post.description}</p>
                               <div className="vehicle-meta">
                                 <span>by {post.authorName}</span>
                                 <span>{formatTxDate(post.createdAt)}</span>
                               </div>
                               {vehicleDeleteState === 'error' && vehicleDeleteError ? (
                                 <p className="save-error" aria-live="polite">{vehicleDeleteError}</p>
                               ) : null}
                             </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>
              </>
            )}
          </section>
        ) : null}

        {current === 'admin' ? <AdminWorkspace canManageUsers={role === 'admin'} defaultSection="overview" /> : null}

        {current === 'editor-news' ? <AdminWorkspace canManageUsers={role === 'admin'} defaultSection="articles" /> : null}

        {current !== 'home' &&
        current !== 'news-detail' &&
        current !== 'vehicles' &&
        current !== 'account-settings' &&
        current !== 'wallet' &&
        current !== 'admin' &&
        current !== 'editor-news' ? (
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Section: {current}</h2>
            <p className="muted">Shell page ready for feature integration and API data binding.</p>
          </section>
        ) : null}

        {current === 'wallet' ? (
          <section className="card account-settings">
            <h2 style={{ marginTop: 0 }}>Wallet</h2>
            {!sessionUser ? (
              <p className="muted">You must be logged in to access wallet.</p>
            ) : (
              <div className="account-fields">
                <div className="account-row wallet-summary">
                  <span className="muted">Account ID</span>
                  <span className="wallet-id">{sessionUser.id}</span>
                </div>
                <div className="account-row wallet-summary">
                  <span className="muted">IBAN</span>
                  <span className="wallet-iban-wrap">
                    {walletIbanEditing ? (
                      <>
                        <input
                          className="field-input wallet-iban-input"
                          value={bankAccountId}
                          onChange={(e) => setBankAccountId(e.target.value)}
                          maxLength={64}
                          placeholder="e.g. 54951078"
                        />
                        <button
                          type="button"
                          className="btn btn-solid wallet-iban-btn"
                          onClick={() => void handleWalletIbanSave()}
                          disabled={walletIbanState === 'saving'}
                        >
                          {walletIbanState === 'saving' ? '...' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-ghost wallet-iban-btn" onClick={handleWalletIbanCancel}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="wallet-id wallet-iban-toggle"
                          onClick={() => setWalletIbanVisible((v) => !v)}
                          title={walletIbanVisible ? 'Hide IBAN' : 'Show IBAN'}
                        >
                          {sessionUser.bankAccountId
                            ? walletIbanVisible
                              ? sessionUser.bankAccountId
                              : maskBankAccountId(sessionUser.bankAccountId)
                            : 'Not set'}
                        </button>
                        <button
                          type="button"
                          className="icon-btn wallet-iban-edit"
                          onClick={() => {
                            startWalletIbanEditing();
                          }}
                          aria-label="Edit IBAN"
                        >
                          <Pencil size={13} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {walletIbanMessage ? (
                  <div className={`wallet-iban-message ${walletIbanState === 'error' ? 'error' : 'ok'}`}>{walletIbanMessage}</div>
                ) : null}
                <div className="account-row wallet-summary">
                  <span className="muted">Balance</span>
                  <span className="wallet-pill">${walletBalance ?? '0.00'}</span>
                </div>

                <label className="field-label" htmlFor="withdrawAmount">
                  Withdraw amount
                </label>
                <input
                  id="withdrawAmount"
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="e.g. 2500"
                />

                <div className="row action-row">
                  <button className="btn btn-solid" onClick={() => void handleWithdraw()} disabled={withdrawState === 'submitting'}>
                    {withdrawState === 'submitting' ? '...' : 'Withdraw'}
                  </button>
                  {withdrawState === 'ok' && withdrawMessage ? <span className="save-ok">{withdrawMessage}</span> : null}
                  {withdrawState === 'error' && withdrawMessage ? <span className="save-error">{withdrawMessage}</span> : null}
                </div>

                <section className="tx-log" aria-labelledby="tx-log-title">
                  <div className="tx-log-head">
                    <h3 id="tx-log-title">Transactions</h3>
                    <div className="tx-filter" role="group" aria-label="Filter transactions by status">
                      <button className={`btn ${txFilter === 'all' ? 'btn-solid' : 'btn-ghost'}`} onClick={() => setTxFilter('all')}>
                        All
                      </button>
                      <button className={`btn ${txFilter === 'success' ? 'btn-solid' : 'btn-ghost'}`} onClick={() => setTxFilter('success')}>
                        Success
                      </button>
                      <button className={`btn ${txFilter === 'failed' ? 'btn-solid' : 'btn-ghost'}`} onClick={() => setTxFilter('failed')}>
                        Failed
                      </button>
                    </div>
                  </div>

                  {txState === 'loading' ? <p className="muted">Loading transactions...</p> : null}
                  {txState === 'error' ? <p className="save-error">Could not load transaction history.</p> : null}
                  {(txState === 'empty' || (txState === 'ready' && filteredTransactions.length === 0)) ? (
                    <p className="muted">No transactions found for this filter.</p>
                  ) : null}

                  {txState === 'ready' && filteredTransactions.length > 0 ? (
                    <ul className="tx-list" aria-live="polite">
                      {filteredTransactions.map((tx) => (
                        <li key={tx.id} className="tx-item">
                          <div className="tx-main">
                            <span className="tx-hash" title={tx.hash}>
                              {shortHash(tx.hash)}
                            </span>
                            <span className="tx-amount">
                              {tx.direction === 'send' ? '-' : '+'}${tx.amount.toFixed(2)} {tx.asset}
                            </span>
                          </div>
                          <div className="tx-meta">
                            <span>{formatTxDate(tx.timestamp)}</span>
                            <span className="tx-direction">{tx.direction}</span>
                            <span className={`tx-status ${tx.status}`}>{tx.status}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </div>
            )}
          </section>
        ) : null}

        {current === 'account-settings' ? (
          <section className="card account-settings">
            <h2 style={{ marginTop: 0 }}>Account Settings</h2>
            <p className="muted">Set your IC character name and profile picture for roleplay identity.</p>

            {!sessionUser ? (
              <p className="muted">You must be logged in to edit account settings.</p>
            ) : (
              <>
                <div className="account-settings-grid">
                  <div className="account-preview">
                    {profileImageDataUrl ?? sessionUser.avatarUrl ? (
                      <img
                        src={profileImageDataUrl ?? sessionUser.avatarUrl ?? undefined}
                        alt={sessionUser.username}
                        className="account-preview-image"
                      />
                    ) : (
                      <span className="account-preview-fallback">{sessionUser.username.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="account-fields">
                    <label className="field-label" htmlFor="icCharacterName">
                      IC Character Name
                    </label>
                    <input
                      id="icCharacterName"
                      className="field-input"
                      value={icCharacterName}
                      onChange={(e) => setIcCharacterName(e.target.value)}
                      maxLength={48}
                      placeholder="e.g. Mason Walker"
                    />

                    <label className="field-label" htmlFor="profileImageUpload">
                      Profile Picture
                    </label>
                    <input
                      id="profileImageUpload"
                      className="field-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleProfileFileChange(e.target.files?.[0] ?? null)}
                    />

                    <label className="field-label" htmlFor="bankAccountId">
                      In-game IBAN
                    </label>
                    <input
                      id="bankAccountId"
                      className="field-input"
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      maxLength={64}
                      placeholder="e.g. 54951078"
                    />

                    <div className="row action-row">
                      <button className="btn btn-solid" onClick={() => void handleSaveProfile()} disabled={saveState === 'saving'}>
                        {saveState === 'saving' ? '...' : 'Save'}
                      </button>
                      {saveState === 'saved' ? <span className="save-ok">Saved</span> : null}
                      {saveState === 'error' ? <span className="save-error">Save failed</span> : null}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}
        </div>
      </main>

      {vehicleModalOpen ? (
        <div className="overlay" onClick={() => setVehicleModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title" ref={vehicleModalRef} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 id="vehicle-modal-title">Create vehicle post</h2>
              <button className="icon-btn" onClick={() => setVehicleModalOpen(false)} aria-label="Close vehicle submit modal">
                <X size={16} />
              </button>
            </div>

            <div className="account-fields">
              <label className="field-label" htmlFor="vehicleTitleModal">
                Title
              </label>
              <input
                id="vehicleTitleModal"
                ref={vehicleModalFirstInputRef}
                className="field-input"
                value={vehicleTitle}
                onChange={(e) => setVehicleTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. Elegy Retro Street Build"
              />

              <label className="field-label" htmlFor="vehicleDescriptionModal">
                Description
              </label>
              <textarea
                id="vehicleDescriptionModal"
                className="field-input field-textarea"
                value={vehicleDescription}
                onChange={(e) => setVehicleDescription(e.target.value)}
                maxLength={400}
                placeholder="What makes this build special?"
              />

              <label className="field-label" htmlFor="vehicleImagesModal">
                Images (max 5)
              </label>
              <input
                id="vehicleImagesModal"
                className="field-file"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void handleVehicleImagesSelected(e.target.files)}
              />

              {vehicleModalImages.length > 0 ? (
                <div className="vehicle-preview-grid">
                  {vehicleModalImages.map((src, index) => (
                    <div key={`${src.slice(0, 24)}-${index}`} className="vehicle-preview-item">
                      <img src={src} alt={`Selected vehicle ${index + 1}`} className="vehicle-preview-image" />
                      <button className="icon-btn vehicle-preview-remove" onClick={() => removeVehicleImage(index)} aria-label={`Remove image ${index + 1}`}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="modal-errors" aria-live="polite">
                {vehicleImageError ? <span className="save-error">{vehicleImageError}</span> : null}
                {vehicleFormState === 'error' && vehicleFormMessage ? <span className="save-error">{vehicleFormMessage}</span> : null}
              </div>

              <div className="row action-row">
                <button className="btn btn-solid" onClick={() => void handleCreateVehiclePost()} disabled={vehicleFormState === 'submitting'}>
                  {vehicleFormState === 'submitting' ? 'Posting...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {current === 'vehicles' && sessionUser ? (
        <button
          className="fab-create-post"
          aria-label="Create vehicle post"
          onClick={() => {
            setVehicleFormState('idle');
            setVehicleFormMessage(null);
            setVehicleImageError(null);
            setVehicleModalOpen(true);
          }}
        >
          <Plus size={20} />
        </button>
      ) : null}

      {lightbox && activeLightboxPost && activeLightboxImages.length > 0 ? (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn lightbox-close" onClick={() => setLightbox(null)} aria-label="Close gallery">
              <X size={17} />
            </button>

            {activeLightboxImages.length > 1 ? (
              <button
                className="icon-btn lightbox-nav left"
                onClick={() =>
                  setLightbox((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      index: (prev.index - 1 + activeLightboxImages.length) % activeLightboxImages.length,
                    };
                  })
                }
                aria-label="Previous image"
              >
                <ChevronLeft size={18} />
              </button>
            ) : null}

            <img
              src={activeLightboxImages[activeLightboxIndex]}
              alt={`${activeLightboxPost.title} image ${activeLightboxIndex + 1}`}
              className="lightbox-image"
            />

            {activeLightboxImages.length > 1 ? (
              <button
                className="icon-btn lightbox-nav right"
                onClick={() =>
                  setLightbox((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      index: (prev.index + 1) % activeLightboxImages.length,
                    };
                  })
                }
                aria-label="Next image"
              >
                <ChevronRight size={18} />
              </button>
            ) : null}

            <div className="lightbox-meta">
              <strong>{activeLightboxPost.title}</strong>
              <span>
                {activeLightboxIndex + 1}/{activeLightboxImages.length}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function formatTxDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function maskBankAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '*'.repeat(trimmed.length);
  return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}
