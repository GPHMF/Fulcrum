// Provider data will be loaded from external JSON file
let providerData = null;

// Load provider data from JSON file
async function loadProviderData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status}`);
    }
    providerData = await response.json();
    console.log('✅ Provider data loaded successfully');
    return providerData;
  } catch (error) {
    console.error('❌ Error loading provider data:', error);
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-primary);">
          <h2>Unable to Load Content</h2>
          <p>Please refresh the page. If the problem persists, contact support.</p>
          <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 1rem;">
            Error: ${error.message}
          </p>
        </div>
      `;
    }
    throw error;
  }
}

let currentProvider = null;
let currentCategory = 'mental';

// Initialize app
async function init() {
	// Load data before anything else
  try {
    await loadProviderData();
  } catch (error) {
    // Error already handled in loadProviderData, just return
    return;
  }
  
  setupEventListeners();
  setupSearch();
  
  // Handle hash-based routing
  handleRouting();
    
  // Listen for hash changes (back/forward buttons, manual hash changes)
  window.addEventListener('hashchange', () => {
    handleRouting();
  });
}

// Setup event listeners
function setupEventListeners() {
  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
    });
  }

    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        // Check for manual override in localStorage
        const savedTheme = localStorage.getItem('theme');

        if (savedTheme) {
            // User has manually set a preference - use it
            document.documentElement.setAttribute('data-color-scheme', savedTheme);
			updateFavicon(savedTheme);
        } else {
            // No manual preference - detect system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-color-scheme', systemTheme);
			updateFavicon(systemTheme);
        }

        themeToggle.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-color-scheme');
            const newTheme = theme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-color-scheme', newTheme);
            localStorage.setItem('theme', newTheme);
			updateFavicon(newTheme);
        });
    }
	
	// Update favicon based on theme
	function updateFavicon(theme) {
	  const favicon = document.getElementById('favicon');
	  if (favicon) {
		if (theme === 'dark') {
		  favicon.href = 'src/favicon_dark.jpg';
		} else {
		  favicon.href = 'src/favicon_light.jpg';
		}
	  }
	}

  // Navigation links
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const section = e.target.dataset.section;
      window.location.hash = section === 'home' ? '' : section;
      if (mobileMenu) {
        mobileMenu.classList.remove('active');
      }
    });
  });

  // Provider cards
  const providerCards = document.querySelectorAll('.provider-card');
  providerCards.forEach(card => {
  card.addEventListener('click', () => {
    const provider = card.dataset.provider;
    window.location.hash = `provider/${provider}`;
    });
  });

  // Back button
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.hash = '';
    });
  }

  // Category tabs
  const categoryTabs = document.querySelectorAll('.category-tab');
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const category = e.target.dataset.category;
      if (currentProvider) {
        window.location.hash = `provider/${currentProvider}/${category}`;
      }
    });
  });

  // Organizational category toggles
  const orgHeaders = document.querySelectorAll('.org-category-header');
  orgHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const toggleId = header.dataset.toggle;
      const content = document.getElementById(toggleId);
      
      header.classList.toggle('active');
      content.classList.toggle('is-collapsed');
    });
  });
}

// Setup search functionality
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  
  if (searchInput) {
    // Handle input with debouncing
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase().trim();
        performSearch(searchTerm);
      }, 300); // 300ms debounce
    });

    // Handle focus - show results if search has value
    searchInput.addEventListener('focus', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      if (searchTerm.length >= 2) {
        performSearch(searchTerm);
      }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        hideSearchResults();
      }
    });
  }
}

// Enhanced HTML stripping that preserves context
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    // Add spaces around block elements to prevent word concatenation
    const blockElements = tmp.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, td, th, br');
    blockElements.forEach(el => {
        el.insertAdjacentText('afterend', ' ');
    });
    
    // Extract text content
    let text = tmp.textContent || tmp.innerText || '';
    
    // Clean up excessive whitespace while preserving single spaces
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}

// Enhanced search helper with fuzzy matching
function searchInContent(content, searchTerm) {
    if (!content) return false;
    
    const text = stripHtml(content).toLowerCase();
    const term = searchTerm.toLowerCase().trim();
    
    // Exact phrase match (highest priority)
    if (text.includes(term)) return true;
    
    // Fuzzy match: check if all words in search term exist in content
    const words = term.split(/\s+/).filter(w => w.length > 0);
    return words.every(word => text.includes(word));
}

// Extract context snippet with search term highlighted
function getContextSnippet(content, searchTerm, maxLength = 150) {
    if (!content || !searchTerm) return '';
    
    const text = stripHtml(content);
    const lowerText = text.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    
    // Find first occurrence of any search word
    const words = lowerTerm.split(/\s+/).filter(w => w.length > 0);
    let firstIndex = -1;
    let matchedWord = '';
    
    for (const word of words) {
        const index = lowerText.indexOf(word);
        if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
            firstIndex = index;
            matchedWord = word;
        }
    }
    
    if (firstIndex === -1) return text.substring(0, maxLength) + '...';
    
    // Calculate snippet boundaries
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, firstIndex - halfLength);
    let end = Math.min(text.length, firstIndex + matchedWord.length + halfLength);
    
    // Adjust to word boundaries
    if (start > 0) {
        const spaceIndex = text.lastIndexOf(' ', start);
        if (spaceIndex > 0) start = spaceIndex + 1;
    }
    if (end < text.length) {
        const spaceIndex = text.indexOf(' ', end);
        if (spaceIndex > 0) end = spaceIndex;
    }
    
    let snippet = text.substring(start, end);
    
    // Add ellipsis
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    // Highlight all search words (case-insensitive)
    words.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        snippet = snippet.replace(regex, '<mark>$1</mark>');
    });
    
    return snippet;
}

// Calculate relevance score for a search result
function calculateRelevanceScore(result, searchTerm) {
    let score = 0;
    const lowerTerm = searchTerm.toLowerCase();
    const lowerTitle = result.title.toLowerCase();
    const lowerSnippet = (result.snippet || '').toLowerCase().replace(/<[^>]*>/g, '');
    const lowerProvider = (result.providerTitle || '').toLowerCase();
    const searchWords = lowerTerm.split(/\s+/).filter(w => w.length > 0);
    
    // 1. Exact title match (highest priority) - 100 points
    if (lowerTitle === lowerTerm) {
        score += 100;
    }
    
    // 2. Title starts with search term - 50 points
    if (lowerTitle.startsWith(lowerTerm)) {
        score += 50;
    }
    
    // 3. Title contains exact phrase - 40 points
    if (lowerTitle.includes(lowerTerm)) {
        score += 40;
    }
    
    // 4. All search words in title - 30 points
    const allWordsInTitle = searchWords.every(word => lowerTitle.includes(word));
    if (allWordsInTitle) {
        score += 30;
    }
    
    // 5. Each word found in title - 10 points per word
    searchWords.forEach(word => {
        if (lowerTitle.includes(word)) {
            score += 10;
        }
    });
    
    // 6. Provider name contains search word - 25 points per word
    searchWords.forEach(word => {
        if (lowerProvider.includes(word)) {
            score += 25;
        }
    });
    
    // 7. Exact provider match - 50 points
    if (searchWords.some(word => lowerProvider === word)) {
        score += 50;
    }
    
    // 8. Search term in snippet - 5 points
    if (lowerSnippet.includes(lowerTerm)) {
        score += 5;
    }
    
    // 9. Content type priority
    const typeScores = {
        'Introduction': 30,  // Broad overviews get high score
        'Strategy': 20,       // Actionable content
        'Stressor': 15,       // Problem identification
        'Resource': 15,       // Helpful resources
        'Focus Area': 15      // Specific topics
    };
    score += typeScores[result.type] || 10;
    
    return score;
}

// Perform search
function performSearch(searchTerm) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    
    // Clear results if search is too short
    if (!searchTerm || searchTerm.length < 2) {
        hideSearchResults();
        return;
    }
    if (!providerData) {
		console.warn('Search attempted before data loaded');
		searchResults.innerHTML = '<div class="search-no-results">Loading data, please try again...</div>';
		searchResults.classList.remove('hidden');
		return;
	}
    const results = [];
    const normalizedTerm = searchTerm.toLowerCase().trim();
    
    // Search through all provider data
    Object.entries(providerData).forEach(([providerId, providerInfo]) => {
        Object.entries(providerInfo).forEach(([categoryId, categoryData]) => {
            // Skip the title property
            if (categoryId === 'title') return;
            
            const providerTitle = providerInfo.title;
            const categoryTitle = formatSectionName(categoryId);
            
            // Search in introduction
			if (categoryData.introduction && searchInContent(categoryData.introduction, normalizedTerm)) {
				const snippet = getContextSnippet(categoryData.introduction, normalizedTerm);
    
				results.push({
					provider: providerId,
					providerTitle: providerTitle,
					category: categoryId,
					categoryTitle: categoryTitle,
					type: 'Introduction',
					title: `${providerTitle} - ${categoryTitle}`,
					snippet: snippet,
					section: 'introduction'
				});
			}

            
            // Search in stressors
			if (categoryData.stressors && Array.isArray(categoryData.stressors)) {
				categoryData.stressors.forEach((stressor, index) => {
					if (searchInContent(stressor.title, normalizedTerm) || 
						searchInContent(stressor.detail, normalizedTerm)) {
            
						const matchedContent = searchInContent(stressor.detail, normalizedTerm) ? 
							stressor.detail : stressor.title;
						const snippet = getContextSnippet(matchedContent, normalizedTerm);
            
						results.push({
							provider: providerId,
							providerTitle: providerTitle,
							category: categoryId,
							categoryTitle: categoryTitle,
							type: 'Stressor',
							title: stressor.title,
							snippet: snippet,
							section: 'stressors',
							index: index
						});
					}
				});
			}

            
            // Search in strategies
			if (categoryData.strategies && Array.isArray(categoryData.strategies)) {
				categoryData.strategies.forEach((strategy, index) => {
					if (searchInContent(strategy.title, normalizedTerm) || 
						searchInContent(strategy.detail, normalizedTerm)) {
            
						const matchedContent = searchInContent(strategy.detail, normalizedTerm) ? 
							strategy.detail : strategy.title;
						const snippet = getContextSnippet(matchedContent, normalizedTerm);
            
						results.push({
							provider: providerId,
							providerTitle: providerTitle,
							category: categoryId,
							categoryTitle: categoryTitle,
							type: 'Strategy',
							title: strategy.title,
							snippet: snippet,
							section: 'strategies',
							index: index
						});
					}
				});
			}

            
            // Search in resources
			if (categoryData.resources && Array.isArray(categoryData.resources)) {
				categoryData.resources.forEach((resource, index) => {
					if (searchInContent(resource.name, normalizedTerm) || 
						searchInContent(resource.description, normalizedTerm)) {
            
						const matchedContent = searchInContent(resource.description, normalizedTerm) ? 
							resource.description : resource.name;
						const snippet = getContextSnippet(matchedContent, normalizedTerm);
            
						results.push({
							provider: providerId,
							providerTitle: providerTitle,
							category: categoryId,
							categoryTitle: categoryTitle,
							type: 'Resource',
							title: resource.name,
							snippet: snippet,
							section: 'resources',
							index: index
						});
					}
				});
			}

            
            // Search in focus_areas
			if (categoryData.focus_areas && Array.isArray(categoryData.focus_areas)) {
				categoryData.focus_areas.forEach((area, index) => {
					if (searchInContent(area.title, normalizedTerm) || 
						searchInContent(area.detail, normalizedTerm)) {
            
						const matchedContent = searchInContent(area.detail, normalizedTerm) ? 
							area.detail : area.title;
						const snippet = getContextSnippet(matchedContent, normalizedTerm);
            
						results.push({
							provider: providerId,
							providerTitle: providerTitle,
							category: categoryId,
							categoryTitle: categoryTitle,
							type: 'Focus Area',
							title: area.title,
							snippet: snippet,
							section: 'focus_areas',
							index: index
						});
					}
				});
			}

        });
    });
    
	// Sort results by relevance score (highest first)
	results.sort((a, b) => {
		const scoreA = calculateRelevanceScore(a, searchTerm);
		const scoreB = calculateRelevanceScore(b, searchTerm);
		return scoreB - scoreA; // Higher scores first
	});
	
    // Display results
    displaySearchResults(results, searchTerm);
}

// Display search results in dropdown
function displaySearchResults(results, searchTerm) {
  const searchResults = document.getElementById('searchResults');
  
  if (!searchResults) return;
  
  // Clear previous results
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-no-results">No results found for "' + searchTerm + '"</div>';
    searchResults.classList.remove('hidden');
    return;
  }

  // Limit to top 10 results
  const limitedResults = results.slice(0, 10);
  
  limitedResults.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    
    // Format the result display with snippet
	resultItem.innerHTML = `
		<div class="search-result-title">${result.title}</div>
		${result.snippet ? `<div class="search-result-snippet">${result.snippet}</div>` : ''}
		<div class="search-result-category">
			<span class="search-result-provider">${result.providerTitle}</span>
			<span class="search-result-separator"> • </span>
			<span class="search-result-cat">${result.categoryTitle}</span>
			<span class="search-result-separator"> • </span>
			<span class="search-result-type">${result.type}</span>
		</div>
`	;

    
    // Make it clickable - navigate to the content
	resultItem.addEventListener('click', () => {
		// Hide search first
		hideSearchResults();
		clearSearchInput();

		// Convert category format: 'mentalhealth' -> 'mental', 'physicalhealth' -> 'physical'
		let categoryShort;
		if (result.type === 'Resource' || result.section === 'resources') {
			categoryShort = 'resources';
		} else {
			categoryShort = result.category.includes('mental') ? 'mental' : 'physical';
		}
    
		// Build the CORRECT hash URL format: #provider/{providerId}/{category}
		const hash = `#provider/${result.provider}/${categoryShort}`;
		window.location.hash = hash;

		// Wait for navigation and tab switching to complete, then scroll
		setTimeout(() => {
			if (result.section) {
				scrollToSection(result.section, result.title, result.category);
			}
		}, 500); // Increased to 500ms to allow tab switch to complete
	});

    
    searchResults.appendChild(resultItem);
  });
  
  searchResults.classList.remove('hidden');
}

// Navigate to specific content
function navigateToContent(result) {
  // First, show the provider detail page
  showProviderDetail(result.provider);
  
  // Switch to correct category (mental or physical health)
  const category = result.category === 'mentalhealth' ? 'mental' : 'physical';
  switchCategory(category);
  
  // Wait for content to load, then scroll to section
  setTimeout(() => {
    scrollToSection(result.section, result.title);
  }, 300);
}

// Scroll to specific section and highlight it
function scrollToSection(section, title, category, retries = 3) {
    // Determine category type (mental or physical)
    let categoryType = currentCategory;
    
    if (category) {
        categoryType = category.includes('mental') ? 'mental' : 
                      category.includes('physical') ? 'physical' : 
                      currentCategory;
    }
    
    const sectionMap = {
        'stressors': 'stressors-list',
        'strategies': 'strategies-list',
        'focus_areas': 'focus-areas-list',
        'resources': 'resources-content',
        'introduction': categoryType === 'mental' ? 'mental-introduction' : 'physical-introduction',
        'detailedGuide': categoryType === 'mental' ? 'mental-detailed-guide' : 'physical-detailed-guide',
        'key_points': 'key-points-section'
    };
    
    const targetId = sectionMap[section];
    if (!targetId) {
        console.warn(`No mapping found for section: ${section}`);
        return;
    }
    
    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
        // Element not found - retry if we have retries left
        if (retries > 0) {
            console.log(`Element ${targetId} not ready. Retrying in 200ms... (${retries} left)`);
            setTimeout(() => {
                scrollToSection(section, title, category, retries - 1);
            }, 200);
            return;
        } else {
            console.warn(`Failed to find element: ${targetId}`);
            return;
        }
    }
    
    // For container sections (introduction, etc.)
    if (section === 'introduction' || section === 'detailedGuide' || section === 'key_points') {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        const originalBackground = targetElement.style.backgroundColor;
        targetElement.style.backgroundColor = 'var(--color-secondary)';
        setTimeout(() => {
            targetElement.style.transition = 'background-color 1s ease';
            targetElement.style.backgroundColor = originalBackground;
        }, 2000);
        
        return;
    }
    
    // For list-based sections - find specific item
    const items = targetElement.querySelectorAll('.expandable-item, .resource-card');
    
    if (items.length === 0 && retries > 0) {
        // Items not rendered yet - retry
        console.log(`Items in ${targetId} not rendered. Retrying in 200ms... (${retries} left)`);
        setTimeout(() => {
            scrollToSection(section, title, category, retries - 1);
        }, 200);
        return;
    }
    
    let targetItem = null;
    items.forEach(item => {
        const itemText = item.textContent || item.innerText;
        if (itemText.toLowerCase().includes(title.toLowerCase())) {
            targetItem = item;
        }
    });
    
    if (targetItem) {
        // Scroll to specific item
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Expand if expandable
        const header = targetItem.querySelector('.item-header');
        if (header) {
            const detailDiv = targetItem.querySelector('.item-detail');
            if (detailDiv && detailDiv.classList.contains('is-collapsed')) {
                header.click();
            }
        }
        
        // Highlight
        targetItem.style.backgroundColor = 'var(--color-teal-100, rgba(224, 247, 250, 0.5))';
        setTimeout(() => {
            targetItem.style.transition = 'background-color 1s ease';
            targetItem.style.backgroundColor = '';
        }, 2000);
    } else {
        // Fallback: scroll to section container
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Helper function to format section names
function formatSectionName(section) {
  const names = {
    'stressors': 'Stressors',
    'strategies': 'Strategies',
    'focus_areas': 'Focus Areas',
    'resources': 'Resources'
  };
  return names[section] || section;
}

// Hide search results dropdown
function hideSearchResults() {
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.classList.add('hidden');
  }
}

// Clear search input
function clearSearchInput() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
}

// Handle hash-based routing for GitHub Pages
function handleRouting() {
    const hash = window.location.hash.slice(1); // Remove the # symbol
    
    if (!hash || hash === '' || hash === 'home') {
        navigateToSection('home');
    } else if (hash.startsWith('provider/')) {
        const parts = hash.split('/').filter(p => p);
        const provider = parts[1];
        if (provider && providerData[provider]) {
            showProviderDetail(provider);
            if (parts[2]) {
                switchCategory(parts[2]);
            }
        } else {
            // Invalid provider, go to home
            navigateToSection('home');
        }
    } else if (hash === 'crisis') {
        navigateToSection('crisis');
    } else if (hash === 'organizational') {
        navigateToSection('organizational');
    } else {
        // Unknown route, default to home
        navigateToSection('home');
    }
}

// Navigate to section
function navigateToSection(section) {
  // Hide all sections
  document.getElementById('home').classList.add('hidden');
  document.querySelector('.provider-selection').classList.add('hidden');
  document.getElementById('provider-detail').classList.add('hidden');
  document.getElementById('crisis').classList.add('hidden');
  document.getElementById('organizational').classList.add('hidden');

  // Show requested section
  if (section === 'home') {
    document.getElementById('home').classList.remove('hidden');
    document.querySelector('.provider-selection').classList.remove('hidden');
  } else if (section === 'crisis') {
    document.getElementById('crisis').classList.remove('hidden');
  } else if (section === 'organizational') {
    document.getElementById('organizational').classList.remove('hidden');
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show provider detail
function showProviderDetail(providerKey) {
  currentProvider = providerKey;
  const provider = providerData[providerKey];

  // Hide home sections
  document.getElementById('home').classList.add('hidden');
  document.querySelector('.provider-selection').classList.add('hidden');

  // Show provider detail
  const detailSection = document.getElementById('provider-detail');
  detailSection.classList.remove('hidden');

  // Update title
  document.getElementById('providerTitle').textContent = provider.title + ' Wellness Resources';

  // Reset to mental health tab
  switchCategory('mental');
  loadProviderContent();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Switch between mental, physical health, and resources categories
function switchCategory(category) {
    
  currentCategory = category;
  
  // Update tab states
  const tabs = document.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    if (tab.dataset.category === category) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Show/hide content
  const mentalContent = document.getElementById('mental-health-content');
  const physicalContent = document.getElementById('physical-health-content');
  const resourcesContent = document.getElementById('resources-content');
  
  // Hide all content sections first
  mentalContent.classList.add('hidden');
  physicalContent.classList.add('hidden');
  if (resourcesContent) {
    resourcesContent.classList.add('hidden');
  }
  
  // Show the selected category
  if (category === 'mental') {
    mentalContent.classList.remove('hidden');
  } else if (category === 'physical') {
    physicalContent.classList.remove('hidden');
  } else if (category === 'resources' && resourcesContent) {
    resourcesContent.classList.remove('hidden');
  }
  
  loadProviderContent();
}

// Load provider content
function loadProviderContent() {
  if (!currentProvider) return;
  
  const provider = providerData[currentProvider];
  
  if (currentCategory === 'mental') {
    loadMentalHealthContent(provider.mentalhealth);
  } else if (currentCategory === 'physical') {
    loadPhysicalHealthContent(provider.physicalhealth);
  } else if (currentCategory === 'resources') {
    loadResourcesContent(currentProvider);
  }
}

/**
 * Parse markdown content to HTML
 * Handles mixed HTML/Markdown content safely
 */
function parseMarkdown(content) {
  if (!content) return content;
  
  // Check if content is already HTML (starts with HTML tags)
  const htmlTagPattern = /^\s*</;
  if (htmlTagPattern.test(content)) {
    return content; // Already HTML, return as-is
  }
  
  // Parse markdown to HTML using marked.js
  try {
    return marked.parse(content);
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return content; // Fallback to original content
  }
}

// Load mental health content
function loadMentalHealthContent(data) {
  // Add introduction if exists
  const mentalHealthContent = document.getElementById('mental-health-content');
  
  // Check if intro section already exists, if not create it
  let introSection = mentalHealthContent.querySelector('.intro-section');
  if (!introSection) {
    introSection = document.createElement('div');
    introSection.className = 'intro-section';
	introSection.id = 'mental-introduction';
    mentalHealthContent.insertBefore(introSection, mentalHealthContent.firstChild);
  }
  introSection.innerHTML = parseMarkdown(data.introduction || '');

  // Load stressors with expandable details
  const stressorsList = document.getElementById('stressors-list');
  stressorsList.innerHTML = '';
  data.stressors.forEach((stressor, index) => {
    const li = document.createElement('li');
    li.className = 'expandable-item';
    
    const title = typeof stressor === 'string' ? stressor : stressor.title;
    const detail = typeof stressor === 'object' ? stressor.detail : '';
    
    li.innerHTML = `
      <div class="item-header" data-toggle="stressor-${index}">
        <strong>${title}</strong>
        ${detail ? '<svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' : ''}
      </div>
      ${detail ? `<div class="item-detail is-collapsed" id="stressor-${index}">${parseMarkdown(detail)}</div>` : ''}
    `;
    
    // Add click handler for expandable items
    if (detail) {
      const header = li.querySelector('.item-header');
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const detailDiv = li.querySelector('.item-detail');
        const icon = li.querySelector('.expand-icon');
        detailDiv.classList.toggle('is-collapsed');
        icon.style.transform = detailDiv.classList.contains('is-collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }
    
    stressorsList.appendChild(li);
  });

  // Load strategies with expandable details
  const strategiesList = document.getElementById('strategies-list');
  strategiesList.innerHTML = '';
  data.strategies.forEach((strategy, index) => {
    const li = document.createElement('li');
    li.className = 'expandable-item';
    
    const title = typeof strategy === 'string' ? strategy : strategy.title;
    const detail = typeof strategy === 'object' ? strategy.detail : '';
    
    li.innerHTML = `
      <div class="item-header" data-toggle="strategy-${index}">
        <strong>${title}</strong>
        ${detail ? '<svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' : ''}
      </div>
      ${detail ? `<div class="item-detail is-collapsed" id="strategy-${index}">${parseMarkdown(detail)}</div>` : ''}
    `;
    
    // Add click handler for expandable items
    if (detail) {
      const header = li.querySelector('.item-header');
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const detailDiv = li.querySelector('.item-detail');
        const icon = li.querySelector('.expand-icon');
        detailDiv.classList.toggle('is-collapsed');
        icon.style.transform = detailDiv.classList.contains('is-collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }
    
    strategiesList.appendChild(li);
  });

  // Add detailed guide if exists
  let guideSection = mentalHealthContent.querySelector('.guide-section-wrapper');
  if (data.detailedGuide) {
    if (!guideSection) {
      guideSection = document.createElement('div');
      guideSection.className = 'guide-section-wrapper';
	  guideSection.id = 'mental-detailed-guide';
      // Insert before resources section
      const resourcesSection = mentalHealthContent.querySelector('.resources-section');
      mentalHealthContent.insertBefore(guideSection, resourcesSection);
    }
    guideSection.innerHTML = parseMarkdown(data.detailedGuide);
  } else if (guideSection) {
    guideSection.remove();
  }

  // Add statistics if exists
  if (data.statistics) {
    let statsSection = mentalHealthContent.querySelector('.statistics-section');
    if (!statsSection) {
      statsSection = document.createElement('div');
      statsSection.className = 'statistics-section';
      mentalHealthContent.appendChild(statsSection);
    }
    
    statsSection.innerHTML = `
      <h3>Key Statistics</h3>
      <div class="stats-grid">
        ${data.statistics.map(stat => `
          <div class="stat-box">
            <div class="stat-value">${stat.value}</div>
            <div class="stat-description">${stat.label}</div>
            ${stat.source ? `<div class="stat-source">Source: ${stat.source}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Load physical health content
function loadPhysicalHealthContent(data) {
  const physicalHealthContent = document.getElementById('physical-health-content');
  
  // Add introduction if exists
  let introSection = physicalHealthContent.querySelector('.intro-section');
  if (!introSection) {
    introSection = document.createElement('div');
    introSection.className = 'intro-section';
	introSection.id = 'physical-introduction';
    physicalHealthContent.insertBefore(introSection, physicalHealthContent.firstChild);
  }
  introSection.innerHTML = parseMarkdown(data.introduction || '');

  // Load focus areas with expandable details
  const focusAreasList = document.getElementById('focus-areas-list');
  focusAreasList.innerHTML = '';
  data.focus_areas.forEach((area, index) => {
    const li = document.createElement('li');
    li.className = 'expandable-item';
    
    const title = typeof area === 'string' ? area : area.title;
    const detail = typeof area === 'object' ? area.detail : '';
    
    li.innerHTML = `
      <div class="item-header" data-toggle="focus-${index}">
        <strong>${title}</strong>
        ${detail ? '<svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' : ''}
      </div>
      ${detail ? `<div class="item-detail is-collapsed" id="focus-${index}">${parseMarkdown(detail)}</div>` : ''}
    `;
    
    // Add click handler for expandable items
    if (detail) {
      const header = li.querySelector('.item-header');
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const detailDiv = li.querySelector('.item-detail');
        const icon = li.querySelector('.expand-icon');
        detailDiv.classList.toggle('is-collapsed');
        icon.style.transform = detailDiv.classList.contains('is-collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }
    
    focusAreasList.appendChild(li);
  });

  // Load key points
  const keyPointsList = document.getElementById('key-points-list');
  if (keyPointsList && keyPointsList.parentElement) {
    keyPointsList.parentElement.id = 'key-points-section';
}
  keyPointsList.innerHTML = '';
  data.key_points.forEach(point => {
    const li = document.createElement('li');
    li.textContent = point;
    keyPointsList.appendChild(li);
  });

  // Add detailed guide if exists
  let guideSection = physicalHealthContent.querySelector('.guide-section-wrapper');
  if (data.detailedGuide) {
    if (!guideSection) {
      guideSection = document.createElement('div');
      guideSection.className = 'guide-section-wrapper';
	  guideSection.id = 'physical-detailed-guide';
      // Insert before stats section
      const statsSection = physicalHealthContent.querySelector('.physical-health-stats');
      physicalHealthContent.insertBefore(guideSection, statsSection);
    }
    guideSection.innerHTML = parseMarkdown(data.detailedGuide);
  } else if (guideSection) {
    guideSection.remove();
  }

  // Update statistics if exists
  if (data.statistics) {
    const statsGrid = physicalHealthContent.querySelector('.stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = data.statistics.map(stat => `
        <div class="stat-box">
          <div class="stat-value">${stat.value}</div>
          <div class="stat-description">${stat.label}</div>
          ${stat.source ? `<div class="stat-source">Source: ${stat.source}</div>` : ''}
        </div>
      `).join('');
    }
  }
 } 
 
function loadResourcesContent(providerType) {
  const data = providerData[providerType];
  
  if (!data) {
    return;
  }
  
  const resourcesContent = document.getElementById('resources-content');
  if (!resourcesContent) return;
  
  // Clear existing content
  resourcesContent.innerHTML = '';
  
  // Create main container with width constraint
  const mainContainer = document.createElement('div');
  mainContainer.className = 'resources-section';
  mainContainer.style.maxWidth = '100%'; // Ensure it doesn't exceed parent
  mainContainer.style.margin = '0 auto';  // Center it
  
  // Add main title
  const mainTitle = document.createElement('h3');
  mainTitle.textContent = 'Professional Resources & Support';
  mainContainer.appendChild(mainTitle);
  
  // Mental Health Resources Section
  if (data.mentalhealth && data.mentalhealth.resources) {
    const mentalSection = document.createElement('div');
    mentalSection.className = 'resource-category';
    
    const mentalTitle = document.createElement('h4');
    mentalTitle.textContent = 'Mental Health Resources';
    mentalTitle.style.marginTop = '1.5rem';
    mentalTitle.style.marginBottom = '1rem';
    mentalSection.appendChild(mentalTitle);
    
    const mentalGrid = document.createElement('div');
    mentalGrid.className = 'resources-grid';
    
    data.mentalhealth.resources.forEach(resource => {
      const card = createResourceCard(resource);
      mentalGrid.appendChild(card);
    });
    
    mentalSection.appendChild(mentalGrid);
    mainContainer.appendChild(mentalSection);
  }
  
  // Physical Health Resources Section
  if (data.physicalhealth && data.physicalhealth.resources) {
    const physicalSection = document.createElement('div');
    physicalSection.className = 'resource-category';
    
    const physicalTitle = document.createElement('h4');
    physicalTitle.textContent = 'Physical Health Resources';
    physicalTitle.style.marginTop = '2rem';
    physicalTitle.style.marginBottom = '1rem';
    physicalSection.appendChild(physicalTitle);
    
    const physicalGrid = document.createElement('div');
    physicalGrid.className = 'resources-grid';
    
    data.physicalhealth.resources.forEach(resource => {
      const card = createResourceCard(resource);
      physicalGrid.appendChild(card);
    });
    
    physicalSection.appendChild(physicalGrid);
    mainContainer.appendChild(physicalSection);
  }
  
  resourcesContent.appendChild(mainContainer);
}

// Helper function to create resource cards
function createResourceCard(resource) {
  const card = document.createElement('div');
  card.className = 'resource-card';
  
  const name = typeof resource === 'string' ? resource : resource.name;
  const description = typeof resource === 'string' ? '' : resource.description;
  const type = typeof resource === 'object' ? resource.type : '';
  const url = typeof resource === 'object' ? resource.url : null;
  
  // If URL exists, make the card a clickable link
  if (url) {
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
    card.onkeypress = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };
  }
  
  card.innerHTML = `
    ${type ? `<span class="resource-type ${type.toLowerCase()}">${type.charAt(0).toUpperCase() + type.slice(1)}</span>` : ''}
    <strong>${name}</strong>
    ${description ? `<p>${description}</p>` : ''}
    ${url ? `<span class="resource-link-indicator">↗</span>` : ''}
  `;
  
  return card;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}