pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb+srv://supercluster.d83jj.mongodb.net/superData"
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-610'
    }

    options {
        disableConcurrentBuilds()
        disableResume()
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
            options { timestamps() }
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                sh 'npm install --include=dev --no-audit'
                echo '🔧 Dependencies installed successfully!'
            }
        }

        stage('Dependency Check') {
            options { timestamps() }
            parallel {
                stage('NPM Dependency Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                        echo '🔍 Audit completed successfully!'
                    }
                }

                stage('OWASP Dependency Check') {
                    steps {
                        echo '🛡️ Running OWASP Dependency Check...'
                        dependencyCheck additionalArguments: '''
                            --scan ./
                            --out ./ 
                            --format ALL 
                            --prettyPrint
                            --disableYarnAudit
                        ''', odcInstallation: 'OWASP-DepCheck'
                    }
                }
            }
        }

        stage('Unit Test') {
            options { timestamps(); retry(2) }
            steps {
                withCredentials([
                    usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')
                ]) {
                    echo '🧪 Running unit tests....'
                    sh 'npm test'
                    echo '🧪 Unit tests completed successfully!'
                }
            }
        }

        stage('Code Coverage & Static Analysis') {
            options { timestamps() }
            parallel {
                stage('Code Coverage') {
                    steps {
                        withCredentials([
                            usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')
                        ]) {
                            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                                echo '📊 Running code coverage....'
                                sh 'npm run coverage'
                                echo '📊 Code coverage completed!'
                            }
                        }
                    }
                }

                stage('SAST - SonarQube') {
                    steps {
                        timeout(time: 60, unit: 'SECONDS') {
                            withSonarQubeEnv('sonar-qube-server') {
                                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                                    echo '🔍 Running SonarQube analysis...'
                                    sh '''
                                        ${SONAR_SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=Solar_System-Project \
                                        -Dsonar.sources=app.js \
                                        -Dsonar.host.url=http://98.81.130.171:9000 \
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                    '''
                                    echo '✅ SonarQube analysis completed!'
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Wait for Quality Gate') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    withSonarQubeEnv('sonar-qube-server') {
                        waitForQualityGate abortPipeline: true
                    }
                }
            }
        }

        stage('Build Docker Image and Vulnerability Scan using Trivy') {
            options { timestamps() }
            parallel {
                stage('Build Docker Image') {
                    steps {
                        echo '🐳 Building Docker image....'
                        sh 'docker build -t indicationmark/solar-system-app:$GIT_COMMIT .'
                        echo '🐳 Docker image built successfully!'
                    }
                }

                stage('Trivy Vulnerability Scan') {
                    steps {
                        echo '🔍 Running Trivy vulnerability scan....'
                        sh '''
                            trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                                --severity LOW,MEDIUM \
                                --exit-code 0 \
                                --quiet \
                                --format json -o trivy-image-MEDIUM-results.json

                            trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                                --severity CRITICAL \
                                --exit-code 1 \
                                --quiet \
                                --format json -o trivy-image-CRITICAL-results.json
                        '''
                        echo '🔍 Trivy vulnerability scan completed!'
                    }

                    post {
                        always {
                            sh '''
                                trivy convert --format template -t "@/usr/local/share/trivy/templates/html.tpl" \
                                    -o trivy-image-MEDIUM-results.html trivy-image-MEDIUM-results.json || echo "Conversion failed"
                                trivy convert --format template -t "@/usr/local/share/trivy/templates/html.tpl" \
                                    -o trivy-image-CRITICAL-results.html trivy-image-CRITICAL-results.json || echo "Conversion failed"
                                trivy convert --format template -t "@/usr/local/share/trivy/templates/junit.tpl" \
                                    -o trivy-image-MEDIUM-results.xml trivy-image-MEDIUM-results.json || echo "Conversion failed"
                                trivy convert --format template -t "@/usr/local/share/trivy/templates/junit.tpl" \
                                    -o trivy-image-CRITICAL-results.xml trivy-image-CRITICAL-results.json || echo "Conversion failed"
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo '✅ Build completed successfully!'
        }

        failure {
            echo '❌ Build failed. Check the logs.'
        }

        always {
            script {
                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'coverage/lcov-report',
                    reportFiles: 'index.html',
                    reportName: 'Code Coverage Report',
                    useWrapperFileDirectly: true
                ])

                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: './',
                    reportFiles: 'dependency-check-jenkins.html',
                    reportName: 'Dependency Check Report',
                    useWrapperFileDirectly: true
                ])

                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: './',
                    reportFiles: 'trivy-image-MEDIUM-results.html',
                    reportName: 'Trivy Medium Report',
                    useWrapperFileDirectly: true
                ])

                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: './',
                    reportFiles: 'trivy-image-CRITICAL-results.html',
                    reportName: 'Trivy Critical Report',
                    useWrapperFileDirectly: true
                ])

                junit allowEmptyResults: true, testResults: 'test-results.xml'
                junit allowEmptyResults: true, testResults: 'trivy-image-MEDIUM-results.xml'
                junit allowEmptyResults: true, testResults: 'trivy-image-CRITICAL-results.xml'
            }
        }
    }
}