import Header from './components/Header.jsx'
import HomeView from './views/HomeView.jsx'

function App() {
  return (
    <div className="page-shell">
      <Header />

      <main className="app-shell">
        <HomeView />
      </main>
    </div>
  )
}

export default App
