pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb://localhost:27017/solar"
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-610'
    }

    options {
        disableConcurrentBuilds()
        disableResume()
        timestamps()
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('VM Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                sh 'npm install --include=dev --no-audit'
                echo '✅ Dependencies installed!'
            }
        }

        stage('Dependency Check') {
            parallel {
                stage('NPM Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                    }
                }
                stage('OWASP Check') {
                    steps {
                        echo '🛡️ Running OWASP Dependency Check...'
                        dependencyCheck additionalArguments: '''\
                            --format HTML \
                            --out . \
                            --scan . \
                            --project "solar-system"'''
                    }
                }
            }
        }

        stage('Unit Test') {
            steps {
                withCredentials([string(credentialsId: 'mongo-password', variable: 'MONGO_PASSWORD')]) {
                    echo '🧪 Running unit tests....'
                    sh 'npm test'
                }
            }
        }

        stage('Code Coverage & SonarQube') {
            parallel {
                stage('Code Coverage') {
                    steps {
                        echo '📊 Running code coverage....'
                        sh 'npm run coverage'
                    }
                }
                stage('SonarQube Scan') {
                    steps {
                        withCredentials([string(credentialsId: 'mongo-password', variable: 'MONGO_PASSWORD')]) {
                            timeout(time: 1, unit: 'MINUTES') {
                                withSonarQubeEnv('sonar-qube-server') {
                                    echo '🔎 Running SonarQube analysis...'
                                    sh '''
                                        ${SONAR_SCANNER_HOME}/bin/sonar-scanner \
                                            -Dsonar.projectKey=Solar_System-Project \
                                            -Dsonar.sources=app.js \
                                            -Dsonar.host.url=http://98.81.130.171:9000 \
                                            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                    '''
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo '🐳 Building Docker image....'
                sh "docker build -t indicationmark/solar-system-app:\$(git rev-parse HEAD) ."
            }
        }

        stage('Trivy Scan') {
            steps {
                echo '🔍 Running Trivy vulnerability scan....'
                script {
                    def tag = sh(script: "git rev-parse HEAD", returnStdout: true).trim()

                    sh "trivy image indicationmark/solar-system-app:${tag} --severity CRITICAL --exit-code 1 --quiet --format json -o trivy-image-CRITICAL-results.json"
                    sh "trivy image indicationmark/solar-system-app:${tag} --severity LOW,MEDIUM --exit-code 0 --quiet --format json -o trivy-image-MEDIUM-results.json"

                    // Convert to HTML and JUnit formats
                    sh '''
                        trivy convert --format template -t @/usr/local/share/trivy/templates/html.tpl \
                            -o trivy-image-CRITICAL-results.html trivy-image-CRITICAL-results.json
                        trivy convert --format template -t @/usr/local/share/trivy/templates/html.tpl \
                            -o trivy-image-MEDIUM-results.html trivy-image-MEDIUM-results.json

                        trivy convert --format template -t @/usr/local/share/trivy/templates/junit.tpl \
                            -o trivy-image-CRITICAL-results.xml trivy-image-CRITICAL-results.json
                        trivy convert --format template -t @/usr/local/share/trivy/templates/junit.tpl \
                            -o trivy-image-MEDIUM-results.xml trivy-image-MEDIUM-results.json
                    '''
                }
                echo '✅ No critical vulnerabilities in Trivy scan.'
            }
        }
    }

    post {
        always {
            script {
                echo '📤 Archiving artifacts....'

                publishHTML([reportName: 'Code Coverage Report', reportDir: 'coverage/lcov-report', reportFiles: 'index.html', keepAll: true, alwaysLinkToLastBuild: true])
                publishHTML([reportName: 'Dependency Check Report', reportDir: '.', reportFiles: 'dependency-check-jenkins.html', keepAll: true, alwaysLinkToLastBuild: true])
                publishHTML([reportName: 'Trivy Medium Report', reportDir: '.', reportFiles: 'trivy-image-MEDIUM-results.html', keepAll: true, alwaysLinkToLastBuild: true])
                publishHTML([reportName: 'Trivy Critical Report', reportDir: '.', reportFiles: 'trivy-image-CRITICAL-results.html', keepAll: true, alwaysLinkToLastBuild: true])

                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    junit allowEmptyResults: true, testResults: 'test-results.xml'
                    junit allowEmptyResults: true, testResults: 'trivy-image-MEDIUM-results.xml'
                    junit allowEmptyResults: true, testResults: 'trivy-image-CRITICAL-results.xml'
                }
            }
        }

        success {
            echo '✅ Build completed successfully!'
        }

        failure {
            echo '❌ Build failed!'
        }
    }
}